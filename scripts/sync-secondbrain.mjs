// Copies markdown notes from the SecondBrain vault (raw/ + wiki/) into
// content/posts/ as blog posts, adding frontmatter (title/date/description)
// where it's missing and kebab-casing filenames into slugs.
//
// Safe to re-run: only touches files it previously generated (marked with
// `sb_source:` in frontmatter). Hand-written posts are never overwritten.
//
// Usage: node scripts/sync-secondbrain.mjs

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const VAULT_DIR =
  process.env.SECOND_BRAIN_VAULT || path.join(process.env.HOME, "Documents/SecondBrain");
const POSTS_DIR = path.join(process.cwd(), "content/posts");
const SOURCES = [
  { dir: path.join(VAULT_DIR, "raw"), tag: "raw" },
  { dir: path.join(VAULT_DIR, "wiki"), tag: "wiki" },
];
const EXCLUDE_NAMES = new Set(["INDEX.md"]);

function kebabCase(name) {
  return name
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function humanize(slug) {
  return slug
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function firstH1(content) {
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

function stripQuotes(value) {
  if (value.length >= 2 && ((value[0] === '"' && value.at(-1) === '"') || (value[0] === "'" && value.at(-1) === "'"))) {
    return value.slice(1, -1);
  }
  return value;
}

// Vault frontmatter is parsed with a permissive `key: value` line scanner rather
// than a real YAML parser — some notes have unescaped colons in values (e.g.
// `book_title: On Writing: A Memoir of the Craft`) that break strict YAML.
// Some older notes also have these metadata lines with no `---` fences at all.
function parseFrontmatter(raw) {
  const lines = raw.split("\n");
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;

  const fenced = lines[i] && lines[i].trim() === "---";
  const scanStart = fenced ? i + 1 : i;
  const data = {};
  let j = scanStart;
  while (j < lines.length) {
    const line = lines[j];
    if (fenced && line.trim() === "---") break;
    const m = line.match(/^([\w][\w-]*):\s?(.*)$/);
    if (!m) {
      if (fenced) { j++; continue; } // tolerate odd lines inside a real fence
      break; // unfenced: stop at the first non `key: value` line
    }
    data[m[1]] = stripQuotes(m[2].trim());
    j++;
  }

  const bodyStart = fenced ? j + 1 : j;
  let contentLines = lines.slice(bodyStart);
  while (contentLines.length && contentLines[0].trim() === "") contentLines.shift();
  return { data, content: contentLines.join("\n") };
}

function normalizeDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

// Drop a leading `# Title` line that just repeats the post title — the page
// template already renders the title in its own header.
function stripLeadingTitle(content, title) {
  const lines = content.split("\n");
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (lines[i] && /^#\s+/.test(lines[i])) {
    const heading = lines[i].replace(/^#\s+/, "").trim();
    if (heading.toLowerCase() === title.toLowerCase()) {
      lines.splice(0, i + 1);
      while (lines.length && lines[0].trim() === "") lines.shift();
      return lines.join("\n");
    }
  }
  return content;
}

function extractDescription(content) {
  const lines = content.split("\n");
  const para = [];
  let started = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (started) break;
      continue;
    }
    if (line.startsWith("#")) {
      if (started) break;
      continue;
    }
    if (/^\**Source:\**/i.test(line)) continue;
    started = true;
    para.push(line);
  }
  let text = para
    .join(" ")
    .replace(/\[\[([^\]|]+)\|?[^\]]*\]\]/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length > 220) text = text.slice(0, 217).trimEnd() + "…";
  return text;
}

function processFile(filePath, tag) {
  const raw = fs.readFileSync(filePath, "utf8");
  let { data, content } = parseFrontmatter(raw);
  content = content.replace(/^\s+/, "");

  const basename = path.basename(filePath, ".md");
  const title = data.title || firstH1(content) || humanize(basename);
  content = stripLeadingTitle(content, title);

  const date =
    normalizeDate(data.captured) ||
    normalizeDate(data.upload_date) ||
    normalizeDate(data.date) ||
    fs.statSync(filePath).mtime.toISOString().slice(0, 10);

  const description = typeof data.description === "string" ? data.description : extractDescription(content);
  const slug = kebabCase(basename);

  return { slug, title, date, description, content, origin: path.relative(VAULT_DIR, filePath), tag };
}

function main() {
  if (!fs.existsSync(POSTS_DIR)) {
    console.error(`content/posts not found at ${POSTS_DIR} — run this from the blog repo root.`);
    process.exit(1);
  }

  const seenSlugs = new Map();
  let written = 0;
  let skippedCollision = 0;

  for (const { dir, tag } of SOURCES) {
    if (!fs.existsSync(dir)) {
      console.warn(`Skipping missing source dir: ${dir}`);
      continue;
    }
    const files = fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".md") && !EXCLUDE_NAMES.has(name))
      .map((name) => path.join(dir, name));

    for (const filePath of files) {
      const post = processFile(filePath, tag);
      const targetPath = path.join(POSTS_DIR, `${post.slug}.md`);

      const priorOrigin = seenSlugs.get(post.slug);
      if (priorOrigin) {
        console.warn(`Slug collision "${post.slug}": ${post.origin} vs ${priorOrigin} — skipping second.`);
        skippedCollision++;
        continue;
      }

      if (fs.existsSync(targetPath)) {
        const existing = fs.readFileSync(targetPath, "utf8");
        if (!/^sb_source:/m.test(matter(existing).content) && !matter(existing).data.sb_source) {
          console.warn(`Skipping "${post.slug}.md" — hand-written post already exists at that slug.`);
          skippedCollision++;
          continue;
        }
      }

      const frontmatter = [
        "---",
        `title: ${JSON.stringify(post.title)}`,
        `date: ${post.date}`,
        `description: ${JSON.stringify(post.description)}`,
        `sb_source: ${post.tag}`,
        `sb_path: ${JSON.stringify(post.origin)}`,
        "---",
        "",
        post.content,
        "",
      ].join("\n");

      fs.writeFileSync(targetPath, frontmatter);
      seenSlugs.set(post.slug, post.origin);
      written++;
    }
  }

  console.log(`Synced ${written} post(s) into content/posts/.${skippedCollision ? ` Skipped ${skippedCollision} due to collisions.` : ""}`);
}

main();
