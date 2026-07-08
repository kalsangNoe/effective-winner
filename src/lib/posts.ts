// Filesystem-backed blog "database". Each post is a markdown file with YAML
// frontmatter living in `content/posts/`. The filename (minus `.md`) is the slug.
// Files are read and parsed at build time from Server Components, so there is no
// runtime cost and every route is statically generated.

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked, type Tokens } from "marked";

const POSTS_DIR = path.join(process.cwd(), "content/posts");

export type Heading = { id: string; text: string; level: 2 | 3 };

/** Frontmatter + slug, enough to render the post list. */
export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  description: string;
};

/** A fully parsed post: metadata plus rendered HTML and its extracted outline. */
export type Post = PostMeta & {
  html: string;
  headings: Heading[];
};

/** Turn heading text into a stable, URL-safe anchor id. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

/** Normalize a frontmatter date (js-yaml may parse it into a Date) to YYYY-MM-DD. */
function formatDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value == null ? "" : String(value);
}

/** Pull h2/h3 headings out of the markdown source for the outline column. */
function extractHeadings(markdown: string): Heading[] {
  return marked
    .lexer(markdown)
    .filter(
      (token): token is Tokens.Heading =>
        token.type === "heading" && (token.depth === 2 || token.depth === 3),
    )
    .map((token) => ({
      id: slugify(token.text),
      text: token.text,
      level: token.depth as 2 | 3,
    }));
}

/**
 * Render markdown to HTML, injecting anchor ids onto h2/h3 so the outline column
 * can jump to them. The ids come from the same `slugify` used by `extractHeadings`,
 * which keeps the outline links and heading anchors in lockstep.
 */
function renderMarkdown(markdown: string): string {
  const html = marked.parse(markdown, { async: false }) as string;
  return html.replace(/<(h[23])>([\s\S]*?)<\/\1>/g, (_match, tag, inner) => {
    const text = inner.replace(/<[^>]+>/g, "");
    return `<${tag} id="${slugify(text)}">${inner}</${tag}>`;
  });
}

/** All post slugs, derived from the `.md` filenames in the content directory. */
export function getPostSlugs(): string[] {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs
    .readdirSync(POSTS_DIR)
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.replace(/\.md$/, ""));
}

/** Read and fully parse a single post, or undefined if the file does not exist. */
export function getPost(slug: string): Post | undefined {
  const fullPath = path.join(POSTS_DIR, `${slug}.md`);
  if (!fs.existsSync(fullPath)) return undefined;

  const { data, content } = matter(fs.readFileSync(fullPath, "utf8"));
  return {
    slug,
    title: typeof data.title === "string" ? data.title : slug,
    date: formatDate(data.date),
    description: typeof data.description === "string" ? data.description : "",
    html: renderMarkdown(content),
    headings: extractHeadings(content),
  };
}

/** Post metadata for every post, newest first. */
export function getPosts(): PostMeta[] {
  return getPostSlugs()
    .map((slug) => {
      const { data } = matter(fs.readFileSync(path.join(POSTS_DIR, `${slug}.md`), "utf8"));
      return {
        slug,
        title: typeof data.title === "string" ? data.title : slug,
        date: formatDate(data.date),
        description: typeof data.description === "string" ? data.description : "",
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
