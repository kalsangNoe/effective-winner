import { redirect } from "next/navigation";
import { getPosts } from "@/lib/posts";

// No standalone blog index — land the reader on the first post so all three
// columns are populated immediately.
export default function BlogIndex() {
  redirect(`/blog/${getPosts()[0].slug}`);
}
