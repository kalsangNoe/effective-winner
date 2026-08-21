"use client";

import { useEffect, useState } from "react";
import type { Heading } from "@/lib/posts";

export function Outline({ headings }: { headings: Heading[] }) {
  const [activeId, setActiveId] = useState<string>(headings[0]?.id ?? "");

  // Scroll-spy: highlight the heading currently nearest the top of the viewport.
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      // Trigger when a heading crosses the upper third of the viewport.
      { rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );

    for (const { id } of headings) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
    event.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
    history.replaceState(null, "", `#${id}`);
  }

  if (headings.length === 0) return null;

  return (
    <nav className="p-4">
      <h2 className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        On this page
      </h2>
      <ul className="flex flex-col gap-1.5">
        {headings.map((heading) => {
          const active = heading.id === activeId;
          return (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                onClick={(event) => handleClick(event, heading.id)}
                aria-current={active ? "location" : undefined}
                className={`block rounded-md py-1 text-sm transition-colors ${
                  heading.level === 3 ? "pl-6 pr-3" : "px-3"
                } ${
                  active
                    ? "font-medium text-zinc-900 dark:text-white"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                }`}
              >
                {heading.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
