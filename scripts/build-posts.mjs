import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const root = process.cwd();
const postsDir = path.join(root, "content", "posts");
const outputDir = path.join(root, "public", "data");
const outputFile = path.join(outputDir, "posts.json");

function slugFromFilename(filename) {
  return filename.replace(/\.md$/i, "");
}

function inferCategory(slug) {
  return slug.startsWith("life-") ? "life" : "electronics";
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  let files = [];
  try {
    files = await fs.readdir(postsDir);
  } catch {
    files = [];
  }

  const posts = [];
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const fullPath = path.join(postsDir, file);
    const raw = await fs.readFile(fullPath, "utf8");
    const { data, content } = matter(raw);
    const slug = data.slug || slugFromFilename(file);
    const category = data.category || inferCategory(slug);

    posts.push({
      slug,
      title: data.title || slug,
      date: data.date || "1970-01-01",
      excerpt: data.excerpt || "",
      tags: Array.isArray(data.tags) ? data.tags : [],
      category,
      content
    });
  }

  posts.sort((a, b) => (a.date < b.date ? 1 : -1));
  await fs.writeFile(outputFile, JSON.stringify(posts, null, 2), "utf8");
  console.log(`Built ${posts.length} posts -> ${path.relative(root, outputFile)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
