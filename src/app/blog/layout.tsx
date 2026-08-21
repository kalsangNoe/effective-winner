import { getPosts } from "@/lib/posts";
import { PostList } from "@/app/components/post-list";
import { MobileNav } from "@/app/components/mobile-nav";

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  const posts = getPosts().map(({ slug, title, date, description }) => ({
    slug,
    title,
    date,
    description,
  }));

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* On phones the post list lives in a top-bar menu instead of a column */}
      <MobileNav posts={posts} />

      {/* Column 1: list of all posts (shared across every post) */}
      <aside className="typo-list sticky top-0 hidden h-dvh w-64 shrink-0 overflow-y-auto md:block">
        {/* Only this instance owns the "/" shortcut — the mobile panel's copy is
            mounted at the same time and would otherwise handle it twice. */}
        <PostList posts={posts} enableShortcut />
      </aside>

      {/* Columns 2 & 3 are rendered by the page */}
      {children}
    </div>
  );
}
