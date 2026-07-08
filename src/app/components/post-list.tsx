"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type PostLink = { slug: string; title: string; date: string };

export function PostList({ posts }: { posts: PostLink[] }) {
  const pathname = usePathname();

  return (
    <nav className="p-4">
      <h2 className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        All posts
      </h2>
      <ul className="flex flex-col gap-0.5">
        {posts.map((post) => {
          const href = `/blog/${post.slug}`;
          const active = pathname === href;
          return (
            <li key={post.slug}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-md px-3 py-1 text-sm transition-colors ${
                  active
                    ? "font-medium text-zinc-900 dark:text-white"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                }`}
              >
                {post.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
