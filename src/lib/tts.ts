// Text preparation for reading a post aloud (see ListenButton).
//
// Speech is chunked rather than handed over in one piece for two reasons:
// Chrome silently truncates a long utterance after ~15 seconds, and short
// utterances give the player something to track — which sentence is being
// spoken, and how far through the article the reader is.

/** Words per minute a synthesized voice averages at rate 1. */
const WORDS_PER_MINUTE = 180;

// Trailing punctuation that belongs to the sentence it closes.
const CLOSERS = `"'”’)]`;
// A period after one of these is an abbreviation, not the end of a sentence.
const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "mt",
  "vs", "etc", "eg", "ie", "al", "inc", "ltd", "co", "no", "vol", "pp", "approx",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
]);

function isAbbreviation(text: string, periodAt: number): boolean {
  let start = periodAt;
  while (start > 0 && /[\p{L}\p{N}]/u.test(text[start - 1])) start -= 1;
  const word = text.slice(start, periodAt);
  // A lone capital is an initial: "Howard S. Becker" is one sentence.
  if (word.length === 1 && /\p{Lu}/u.test(word)) return true;
  return ABBREVIATIONS.has(word.toLowerCase());
}

/**
 * Break prose into utterance-sized pieces: sentences first, then anything still
 * too long split at clause boundaries so no single utterance risks truncation.
 */
export function splitSentences(input: string, maxLength = 220): string[] {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text) return [];

  const sentences: string[] = [];
  let start = 0;

  for (let i = 0; i < text.length; i += 1) {
    if (!".!?…".includes(text[i])) continue;
    if (text[i] === "." && isAbbreviation(text, i)) continue;
    // Decimals and version numbers: "1.5" is not a sentence break.
    if (text[i] === "." && /\d/.test(text[i - 1] ?? "") && /\d/.test(text[i + 1] ?? "")) continue;

    let end = i + 1;
    while (end < text.length && CLOSERS.includes(text[end])) end += 1;
    if (end < text.length && !/\s/.test(text[end])) continue;

    const sentence = text.slice(start, end).trim();
    if (sentence) sentences.push(sentence);
    start = end;
  }
  const tail = text.slice(start).trim();
  if (tail) sentences.push(tail);

  return sentences.flatMap((sentence) => splitLong(sentence, maxLength));
}

/** Cut an over-long sentence at clause breaks, then at words as a last resort. */
function splitLong(sentence: string, maxLength: number): string[] {
  if (sentence.length <= maxLength) return [sentence];

  const pieces: string[] = [];
  let rest = sentence;

  while (rest.length > maxLength) {
    const window = rest.slice(0, maxLength);
    // Prefer a clause break, fall back to the last space in the window.
    const cut = Math.max(
      window.lastIndexOf("; "),
      window.lastIndexOf(", "),
      window.lastIndexOf(" — "),
      window.lastIndexOf(" – "),
    );
    const at = cut > maxLength * 0.4 ? cut + 1 : window.lastIndexOf(" ");
    if (at <= 0) break;
    pieces.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) pieces.push(rest);
  return pieces;
}

/**
 * Plain text from rendered post HTML, for a build-time word count. Posts are
 * trusted, author-written content (see the note in CLAUDE.md); this is a word
 * counter, not a sanitizer. Code blocks are dropped to match what is read out.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|pre)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Rough listening time in minutes, for the button's "· 8 min" hint. */
export function estimateMinutes(text: string, rate = 1): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / (WORDS_PER_MINUTE * rate)));
}

/**
 * The block elements worth reading, in document order. Code blocks are skipped —
 * a synthesized voice reading punctuation aloud is noise, not content — as are
 * blocks that only wrap other blocks, which would otherwise be read twice.
 */
export function collectBlocks(root: ParentNode): HTMLElement[] {
  const selector = "p, li, h2, h3, blockquote, figcaption";
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((element) => {
    if (element.closest("pre")) return false;
    if (element.querySelector(selector)) return false;
    return (element.textContent ?? "").trim().length > 0;
  });
}
