"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildIndex, highlight, parseQuery, searchPosts, type PostLink } from "@/lib/search";

export function PostList({
  posts,
  searchOpen = false,
  enableShortcut = false,
}: {
  posts: PostLink[];
  /** Start with the search field expanded (the mobile bar opens the panel this way). */
  searchOpen?: boolean;
  /** Bind the "/" shortcut. Only the always-mounted desktop column should. */
  enableShortcut?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [searching, setSearching] = useState(searchOpen);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Indexing is per-corpus, so it happens once; a keystroke only re-runs the match.
  const index = useMemo(() => buildIndex(posts), [posts]);
  const parsed = useMemo(() => parseQuery(query), [query]);
  const results = useMemo(() => searchPosts(index, parsed), [index, parsed]);

  // Keep the keyboard-highlighted result visible in the scrolling column.
  useEffect(() => {
    if (!searching) return;
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, searching]);

  const openSearch = useCallback(() => {
    setSearching(true);
    // Focus after the input has been painted.
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const closeSearch = useCallback(() => {
    setSearching(false);
    setQuery("");
  }, []);

  // "/" jumps to search from anywhere on the page, Escape leaves it.
  useEffect(() => {
    if (!enableShortcut) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return;
      event.preventDefault();
      openSearch();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enableShortcut, openSearch]);

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      // First Escape clears a query, a second one collapses the field.
      if (query) {
        setQuery("");
        setActiveIndex(0);
      } else {
        closeSearch();
        inputRef.current?.blur();
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => Math.max(0, Math.min(index + step, results.length - 1)));
      return;
    }
    if (event.key === "Enter") {
      const post = results[activeIndex];
      if (!post) return;
      event.preventDefault();
      inputRef.current?.blur();
      router.push(`/blog/${post.slug}`);
    }
  }

  // The column's top padding lives on this <nav>, not on the scrolling <aside>:
  // padding on the scroll container would leave a strip above the sticky row for
  // list items to show through. Column 3's outline matches.
  return (
    <nav className="p-4 md:pt-12">
      {/* Sticky so search stays reachable while a long list scrolls. Column 3's
          outline heading carries the same row so the two sidebars stay aligned. */}
      <div className="sticky top-0 z-10 flex h-8 items-center gap-2 bg-background px-3 pb-2">
        {searching ? (
          <>
            <SearchIcon className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              autoFocus={searchOpen}
              onChange={(event) => {
                setQuery(event.target.value);
                // A new query means a new result set: highlight its first entry.
                setActiveIndex(0);
              }}
              onKeyDown={onInputKeyDown}
              onBlur={() => {
                if (!query) setSearching(false);
              }}
              placeholder="Search posts"
              aria-label="Search posts"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            <button
              type="button"
              // onMouseDown so the input's blur handler doesn't beat the click.
              onMouseDown={(event) => event.preventDefault()}
              onClick={closeSearch}
              aria-label="Close search"
              className="-mr-1 shrink-0 rounded p-1 text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <h2 className="flex-1 truncate text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              All posts
            </h2>
            <button
              type="button"
              onClick={openSearch}
              aria-label="Search posts"
              aria-expanded={false}
              title={enableShortcut ? "Search posts (/)" : "Search posts"}
              className="-mr-1 shrink-0 rounded p-1 text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white"
            >
              <SearchIcon className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>

      {searching && (
        <p aria-live="polite" className="sr-only">
          {results.length} {results.length === 1 ? "post" : "posts"} match
          {query ? ` "${query}"` : ""}
        </p>
      )}

      <ul ref={listRef} className="flex flex-col gap-1.5">
        {results.map((post, index) => {
          const href = `/blog/${post.slug}`;
          const active = pathname === href;
          // While searching, the keyboard highlight leads instead of the URL.
          const highlighted = searching && index === activeIndex;
          return (
            <li key={post.slug}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                onMouseEnter={() => searching && setActiveIndex(index)}
                className={`block rounded-md px-3 py-1 text-sm transition-colors ${
                  active
                    ? "font-medium text-zinc-900 dark:text-white"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                } ${highlighted ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white" : ""}`}
              >
                {highlight(post.title, parsed.terms).map((segment, position) =>
                  segment.match ? (
                    <mark
                      key={position}
                      className="bg-transparent font-medium text-zinc-900 dark:text-white"
                    >
                      {segment.text}
                    </mark>
                  ) : (
                    <span key={position}>{segment.text}</span>
                  ),
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {searching && results.length === 0 && (
        <div className="px-3 py-1 text-sm text-zinc-400 dark:text-zinc-500">
          <p>No posts match &ldquo;{query}&rdquo;.</p>
          {/* Plain divs, not a list: the <nav> landmark holds post links only. */}
          <div className="mt-3 flex flex-col gap-1.5 text-xs">
            <p>
              <Syntax>writing story</Syntax> both words
            </p>
            <p>
              <Syntax>&ldquo;stories&rdquo; &ldquo;story&rdquo;</Syntax> either one
            </p>
            <p>
              <Syntax>-interview</Syntax> exclude
            </p>
          </div>
        </div>
      )}
    </nav>
  );
}

function Syntax({ children }: { children: React.ReactNode }) {
  return (
    <code className="mr-1.5 font-[family-name:var(--font-mono,ui-monospace)] text-zinc-500 dark:text-zinc-400">
      {children}
    </code>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}
