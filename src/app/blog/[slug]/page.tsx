import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPost, getPosts } from "@/lib/posts";
import { Outline } from "@/app/components/outline";

export function generateStaticParams() {
  return getPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata(props: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const post = getPost(slug);
  if (!post) return {};
  return { title: post.title, description: post.description };
}

export default async function BlogPostPage(props: PageProps<"/blog/[slug]">) {
  const { slug } = await props.params;
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <>
      {/* Column 2: the blog post itself */}
      <main className="typo-article min-w-0 flex-1 overflow-y-auto">
        <article className="mx-auto max-w-2xl px-8 py-16">
          <header className="mb-10">
            <p className="typo-date mb-2 text-sm text-zinc-400 dark:text-zinc-500">{post.date}</p>
            <h1 className="typo-title text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {post.title}
            </h1>
            <p className="typo-desc mt-3 text-lg text-zinc-500 dark:text-zinc-400">
              {post.description}
            </p>
          </header>

          {/* Rendered from markdown; styled by the `.prose` rules in globals.css. */}
          <div className="prose" dangerouslySetInnerHTML={{ __html: post.html }} />
        </article>
      </main>

      {/* Column 3: outline of this post's headings */}
      <aside className="typo-outline sticky top-0 hidden h-dvh w-64 shrink-0 overflow-y-auto pt-8 lg:block">
        <Outline headings={post.headings} />
      </aside>
    </>
  );
}
