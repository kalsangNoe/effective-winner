"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PostList, type PostLink } from "@/app/components/post-list";

/** Which entry point opened the panel: the post list, or search (field focused). */
type Panel = null | "list" | "search";

export function MobileNav({ posts }: { posts: PostLink[] }) {
  const [panel, setPanel] = useState<Panel>(null);
  const pathname = usePathname();
  const open = panel !== null;

  // Close the menu after navigating to a post. Adjusting during render (rather
  // than in an effect) avoids a frame where the panel covers the new post.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setPanel(null);
  }

  // Keep the page from scrolling behind the open menu.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 md:hidden">
        <div className="flex h-12 items-center justify-between px-4">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">The Blog</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPanel((p) => (p === "search" ? null : "search"))}
              aria-expanded={panel === "search"}
              aria-label={panel === "search" ? "Close search" : "Search posts"}
              className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              <svg
                viewBox="0 0 16 16"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                {panel === "search" ? (
                  <path d="M4 4l8 8M12 4l-8 8" />
                ) : (
                  <>
                    <circle cx="7" cy="7" r="4.5" />
                    <path d="M10.5 10.5L14 14" />
                  </>
                )}
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setPanel((p) => (p === "list" ? null : "list"))}
              aria-expanded={panel === "list"}
              aria-label={panel === "list" ? "Close post list" : "Open post list"}
              className="flex h-9 items-center gap-1.5 rounded-md px-2 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              Posts
              <svg
                viewBox="0 0 16 16"
                className={`h-4 w-4 transition-transform ${panel === "list" ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 6l4 4 4-4" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Sibling of the header, not a child: the header's backdrop-blur would
          otherwise become the containing block for this fixed panel. */}
      {open && (
        <div className="typo-list fixed inset-x-0 top-12 bottom-0 z-10 overflow-y-auto bg-background md:hidden">
          {/* Remounting per mode is what makes the search field open focused. */}
          <PostList key={panel} posts={posts} searchOpen={panel === "search"} />
        </div>
      )}
    </>
  );
}
