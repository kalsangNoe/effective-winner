import { getPosts } from "@/lib/posts";
import { PostList } from "@/app/components/post-list";

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  const posts = getPosts().map(({ slug, title, date }) => ({ slug, title, date }));

  return (
    <div className="flex min-h-dvh">
      {/* Column 1: list of all posts (shared across every post) */}
      <aside className="typo-list sticky top-0 h-dvh w-64 shrink-0 overflow-y-auto pt-8">
        <PostList posts={posts} />
      </aside>

      {/* Columns 2 & 3 are rendered by the page */}
      {children}
    </div>
  );
}
