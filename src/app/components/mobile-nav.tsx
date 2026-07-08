"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PostList } from "@/app/components/post-list";

type PostLink = { slug: string; title: string; date: string };

export function MobileNav({ posts }: { posts: PostLink[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the menu after navigating to a post.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Close post list" : "Open post list"}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            Posts
            <svg
              viewBox="0 0 16 16"
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
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
      </header>

      {/* Sibling of the header, not a child: the header's backdrop-blur would
          otherwise become the containing block for this fixed panel. */}
      {open && (
        <div className="typo-list fixed inset-x-0 top-12 bottom-0 z-10 overflow-y-auto bg-white dark:bg-zinc-950 md:hidden">
          <PostList posts={posts} />
        </div>
      )}
    </>
  );
}
