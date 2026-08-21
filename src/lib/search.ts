// Client-side search over post metadata. The whole corpus is a few hundred
// titles the blog layout already ships to the browser, so this needs no index
// file, no dependency and no request — it just reads what is already there.
//
// Query grammar (surfaced to readers in the search field's empty state):
//   steve jobs          every bare word must match  (narrows)
//   "stories" "story"   quoted things are alternatives, any may match (broadens)
//   stories, story      `,`, `|` and `OR` are alternatives too
//   -interview          excludes
// Terms also match by word stem, so `story` finds "Stories" on its own.

export type PostLink = { slug: string; title: string; date: string; description?: string };

/** One thing to look for. `stem` is "" for multi-word phrases, which match literally. */
export type Term = { text: string; stem: string };
/** Terms within a group are alternatives; every group must be satisfied. */
export type Group = { terms: Term[]; negated: boolean };
export type Query = { groups: Group[]; terms: Term[]; isEmpty: boolean };

/**
 * Tiny suffix stemmer — enough to make story/stories and write/writing/writes
 * agree, which is all this corpus needs. Deliberately not a full Porter: an
 * over-eager stemmer produces matches a reader cannot explain.
 */
export function stemWord(word: string): string {
  let w = word.toLowerCase();
  if (w.length <= 3) return w;

  // Plurals.
  if (w.endsWith("ies") && w.length > 4) w = `${w.slice(0, -3)}y`; // stories -> story
  else if (/(?:s|x|z|ch|sh)es$/.test(w) && w.length > 4) w = w.slice(0, -2); // boxes -> box
  else if (w.endsWith("s") && !/(?:ss|us|is)$/.test(w)) w = w.slice(0, -1); // rules -> rule

  // Verb/adverb endings.
  if (w.endsWith("ing") && w.length > 5) w = w.slice(0, -3); // writing -> writ
  else if (w.endsWith("ed") && w.length > 4) w = w.slice(0, -2); // learned -> learn
  else if (w.endsWith("ly") && w.length > 4) w = w.slice(0, -2); // clearly -> clear

  // A doubled consonant left behind by the above (stopped -> stopp -> stop).
  if (/([bdfglmnprt])\1$/.test(w)) w = w.slice(0, -1);
  // Silent trailing e, so write and writing land on the same stem.
  if (w.endsWith("e") && w.length > 4) w = w.slice(0, -1);

  return w;
}

const WORD = /[\p{L}\p{N}]+/gu;

function toTerm(text: string): Term {
  const trimmed = text.trim().toLowerCase();
  // Only single words get a stem; a quoted phrase is matched as written.
  return { text: trimmed, stem: /\s/.test(trimmed) ? "" : stemWord(trimmed) };
}

type Token = { text: string; quoted: boolean; separator: boolean; negated: boolean };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    if (char === '"' || char === "“" || char === "”") {
      // Smart quotes count: phones insert them, and the reader means the same thing.
      const end = input.slice(i + 1).search(/["“”]/);
      const text = end === -1 ? input.slice(i + 1) : input.slice(i + 1, i + 1 + end);
      if (text.trim()) tokens.push({ text, quoted: true, separator: false, negated: false });
      i = end === -1 ? input.length : i + end + 2;
      continue;
    }
    if (char === "," || char === "|") {
      tokens.push({ text: "", quoted: false, separator: true, negated: false });
      i += 1;
      continue;
    }
    if (/\s/.test(char)) {
      i += 1;
      continue;
    }

    let end = i;
    while (end < input.length && !/[\s,|"“”]/.test(input[end])) end += 1;
    const raw = input.slice(i, end);
    i = end;

    if (raw.toLowerCase() === "or") {
      tokens.push({ text: "", quoted: false, separator: true, negated: false });
      continue;
    }
    const negated = raw.length > 1 && raw.startsWith("-");
    tokens.push({
      text: negated ? raw.slice(1) : raw,
      quoted: false,
      separator: false,
      negated,
    });
  }

  return tokens;
}

export function parseQuery(input: string): Query {
  const groups: Group[] = [];
  let pendingOr = false;
  let lastWasQuoted = false;

  for (const token of tokenize(input)) {
    if (token.separator) {
      pendingOr = groups.length > 0;
      continue;
    }
    const term = toTerm(token.text);
    if (!term.text) continue;

    const previous = groups[groups.length - 1];
    // Adjacent quoted things read as "either of these" — that is what someone
    // typing `"stories" "story"` is asking for. An explicit `,`/`OR` does the
    // same for anything. Exclusions always stand alone.
    const joinPrevious =
      previous !== undefined &&
      !previous.negated &&
      !token.negated &&
      (pendingOr || (token.quoted && lastWasQuoted));

    if (joinPrevious) previous.terms.push(term);
    else groups.push({ terms: [term], negated: token.negated });

    pendingOr = false;
    lastWasQuoted = token.quoted;
  }

  const terms = groups.filter((group) => !group.negated).flatMap((group) => group.terms);
  return { groups, terms, isEmpty: groups.length === 0 };
}

/** A post with its searchable text precomputed, so keystrokes only do lookups. */
export type IndexedPost = {
  post: PostLink;
  title: string;
  titleStems: Set<string>;
  haystack: string;
  haystackStems: Set<string>;
};

export function buildIndex(posts: PostLink[]): IndexedPost[] {
  return posts.map((post) => {
    const title = post.title.toLowerCase();
    const haystack = `${post.title} ${post.description ?? ""} ${post.date}`.toLowerCase();
    return {
      post,
      title,
      titleStems: new Set(Array.from(title.matchAll(WORD), (m) => stemWord(m[0]))),
      haystack,
      haystackStems: new Set(Array.from(haystack.matchAll(WORD), (m) => stemWord(m[0]))),
    };
  });
}

/**
 * What to look for literally: the term as typed, plus its stem when that is
 * substantial enough to stand alone. Searching the stem too is what keeps the
 * forms symmetric — "stories" has to reach "Storytelling" the same way "story"
 * does, or a reader still has to guess which form the author used.
 */
function needles(term: Term): string[] {
  return term.stem && term.stem !== term.text && term.stem.length >= 4
    ? [term.text, term.stem]
    : [term.text];
}

/** 0 means no match. Higher is a better hit, which drives result ordering. */
function scoreTerm(entry: IndexedPost, term: Term): number {
  let best = 0;
  for (const needle of needles(term)) {
    if (entry.title.startsWith(needle)) best = Math.max(best, 6);
    else {
      // A match starting at a word boundary beats one buried inside a word.
      const at = entry.title.indexOf(needle);
      if (at !== -1) {
        best = Math.max(best, /[\p{L}\p{N}]/u.test(entry.title[at - 1]) ? 4 : 5);
      }
    }
  }
  if (best > 0) return best;
  if (term.stem && entry.titleStems.has(term.stem)) return 4;
  if (needles(term).some((needle) => entry.haystack.includes(needle))) return 2;
  if (term.stem && entry.haystackStems.has(term.stem)) return 2;
  return 0;
}

/**
 * Posts satisfying every group, best match first. Ties keep the caller's order,
 * which is newest-first, so an unranked search still reads chronologically.
 */
export function searchPosts(index: IndexedPost[], query: Query): PostLink[] {
  if (query.isEmpty) return index.map((entry) => entry.post);

  const scored: { post: PostLink; score: number; order: number }[] = [];

  index.forEach((entry, order) => {
    let total = 0;
    for (const group of query.groups) {
      const best = Math.max(...group.terms.map((term) => scoreTerm(entry, term)));
      if (group.negated) {
        if (best > 0) return; // excluded
      } else {
        if (best === 0) return; // a required group missed
        total += best;
      }
    }
    scored.push({ post: entry.post, score: total, order });
  });

  return scored
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((entry) => entry.post);
}

/**
 * Split `text` into matched / unmatched runs so results can show *why* they
 * matched. Covers literal hits and whole words sharing a term's stem.
 */
export function highlight(text: string, terms: Term[]): { text: string; match: boolean }[] {
  if (terms.length === 0) return [{ text, match: false }];

  const lower = text.toLowerCase();
  const ranges: [number, number][] = [];

  for (const term of terms) {
    if (!term.text) continue;
    for (const needle of needles(term)) {
      let at = lower.indexOf(needle);
      while (at !== -1) {
        ranges.push([at, at + needle.length]);
        at = lower.indexOf(needle, at + needle.length);
      }
    }
    if (!term.stem) continue;
    for (const match of lower.matchAll(WORD)) {
      if (stemWord(match[0]) === term.stem) {
        ranges.push([match.index, match.index + match[0].length]);
      }
    }
  }
  if (ranges.length === 0) return [{ text, match: false }];

  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: [number, number][] = [];
  for (const [start, end] of ranges) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }

  const segments: { text: string; match: boolean }[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) segments.push({ text: text.slice(cursor, start), match: false });
    segments.push({ text: text.slice(start, end), match: true });
    cursor = end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false });
  return segments;
}
