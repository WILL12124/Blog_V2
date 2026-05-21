// ---------------------------------------------------------------------------
// Blog API Worker
// ---------------------------------------------------------------------------
// Routes:
//   GET  /api/health              → { ok, postCount }
//   GET  /api/posts               → post list  (supports ?category, ?limit, ?offset)
//   GET  /api/posts/:slug         → single post with full content + likes
//   GET  /api/posts/:slug/likes   → { slug, likes }
//   POST /api/posts/:slug/like    → increment like, returns { slug, likes }
//   POST /api/posts/:slug/unlike  → decrement like (floor 0), returns { slug, likes }
//   *    everything else          → static assets via ASSETS binding
// ---------------------------------------------------------------------------

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=60",
};

/** Respond with JSON */
function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

/** Simple path-pattern matcher: "/api/posts/:slug" → { slug: "my-post" } */
function matchRoute(pattern, pathname) {
  const patternParts = pattern.split("/");
  const pathParts = pathname.split("/");
  if (patternParts.length !== pathParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

// ---------------------------------------------------------------------------
// Post data loader — reads from the static posts.json built at deploy time
// ---------------------------------------------------------------------------
let cachedPosts = null;

async function loadPosts(env) {
  if (cachedPosts) return cachedPosts;

  const res = await env.ASSETS.fetch(new Request("http://faux/data/posts.json"));
  if (!res.ok) {
    throw new Error(`Failed to load posts.json: ${res.status}`);
  }
  cachedPosts = await res.json();
  return cachedPosts;
}

// ---------------------------------------------------------------------------
// D1 helpers — post likes
// ---------------------------------------------------------------------------

/** Ensure the post_likes table exists (runs once per isolate) */
let dbReady = false;
async function ensureDB(db) {
  if (dbReady) return;
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS post_likes (
       slug TEXT PRIMARY KEY,
       likes INTEGER NOT NULL DEFAULT 0
     )`
  ).run();
  dbReady = true;
}

/** Get likes for a slug (returns 0 if no row exists) */
async function getLikes(db, slug) {
  await ensureDB(db);
  const row = await db
    .prepare("SELECT likes FROM post_likes WHERE slug = ?")
    .bind(slug)
    .first();
  return row ? row.likes : 0;
}

/** Get likes for all slugs as a Map<slug, likes> */
async function getAllLikes(db) {
  await ensureDB(db);
  const { results } = await db
    .prepare("SELECT slug, likes FROM post_likes")
    .all();
  const map = new Map();
  for (const row of results) {
    map.set(row.slug, row.likes);
  }
  return map;
}

/** Increment likes for a slug, return new count */
async function incrementLike(db, slug) {
  await ensureDB(db);
  await db
    .prepare(
      `INSERT INTO post_likes (slug, likes) VALUES (?, 1)
       ON CONFLICT(slug) DO UPDATE SET likes = likes + 1`
    )
    .bind(slug)
    .run();
  const row = await db
    .prepare("SELECT likes FROM post_likes WHERE slug = ?")
    .bind(slug)
    .first();
  return row ? row.likes : 1;
}

/** Decrement likes for a slug (floor 0), return new count */
async function decrementLike(db, slug) {
  await ensureDB(db);
  await db
    .prepare(
      `INSERT INTO post_likes (slug, likes) VALUES (?, 0)
       ON CONFLICT(slug) DO UPDATE SET likes = MAX(likes - 1, 0)`
    )
    .bind(slug)
    .run();
  const row = await db
    .prepare("SELECT likes FROM post_likes WHERE slug = ?")
    .bind(slug)
    .first();
  return row ? row.likes : 0;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/** GET /api/health */
async function handleHealth(env) {
  const posts = await loadPosts(env);
  return json({ ok: true, postCount: posts.length });
}

/**
 * GET /api/posts
 *
 * Query params:
 *   category  — "life" | "electronics" (optional, filters by category)
 *   limit     — max results (default: all)
 *   offset    — skip N results (default: 0)
 *   fields    — "full" to include content body (default: list-only metadata)
 */
async function handlePostList(url, env) {
  const posts = await loadPosts(env);
  const likesMap = await getAllLikes(env.DB);

  const category = url.searchParams.get("category");
  const limit = parseInt(url.searchParams.get("limit"), 10) || 0;
  const offset = parseInt(url.searchParams.get("offset"), 10) || 0;
  const full = url.searchParams.get("fields") === "full";

  let filtered = posts;
  if (category) {
    filtered = filtered.filter((p) => p.category === category);
  }

  const total = filtered.length;

  if (offset > 0) {
    filtered = filtered.slice(offset);
  }
  if (limit > 0) {
    filtered = filtered.slice(0, limit);
  }

  // Strip heavy content field from list responses unless explicitly requested
  const items = filtered.map((post) => {
    const { content, ...meta } = post;
    const out = full ? { ...meta, content } : meta;
    out.likes = likesMap.get(post.slug) || 0;
    return out;
  });

  return json({ posts: items, total, offset, limit: limit || total });
}

/** GET /api/posts/:slug */
async function handlePostBySlug(slug, env) {
  const posts = await loadPosts(env);
  const post = posts.find((p) => p.slug === slug);
  if (!post) {
    return json({ error: "Post not found" }, 404);
  }
  const likes = await getLikes(env.DB, slug);
  return json({ ...post, likes });
}

/** GET /api/posts/:slug/likes */
async function handleGetLikes(slug, env) {
  const likes = await getLikes(env.DB, slug);
  return json({ slug, likes });
}

/** POST /api/posts/:slug/like */
async function handleLike(slug, env) {
  // Verify the post exists
  const posts = await loadPosts(env);
  const post = posts.find((p) => p.slug === slug);
  if (!post) {
    return json({ error: "Post not found" }, 404);
  }

  const likes = await incrementLike(env.DB, slug);
  return json(
    { slug, likes },
    200,
    { "cache-control": "no-store" }
  );
}

/** POST /api/posts/:slug/unlike */
async function handleUnlike(slug, env) {
  // Verify the post exists
  const posts = await loadPosts(env);
  const post = posts.find((p) => p.slug === slug);
  if (!post) {
    return json({ error: "Post not found" }, 404);
  }

  const likes = await decrementLike(env.DB, slug);
  return json(
    { slug, likes },
    200,
    { "cache-control": "no-store" }
  );
}

// ---------------------------------------------------------------------------
// Main fetch handler
// ---------------------------------------------------------------------------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    // ---- API routes -------------------------------------------------------
    if (pathname.startsWith("/api/")) {
      // CORS preflight
      if (method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, POST, OPTIONS",
            "access-control-allow-headers": "Content-Type",
          },
        });
      }

      try {
        // /api/health
        if (pathname === "/api/health" && method === "GET") {
          return await handleHealth(env);
        }

        // /api/posts
        if (pathname === "/api/posts" && method === "GET") {
          return await handlePostList(url, env);
        }

        // /api/posts/:slug/like  (POST)
        const likeMatch = matchRoute("/api/posts/:slug/like", pathname);
        if (likeMatch) {
          if (method !== "POST") return json({ error: "Method not allowed" }, 405);
          return await handleLike(likeMatch.slug, env);
        }

        // /api/posts/:slug/unlike  (POST)
        const unlikeMatch = matchRoute("/api/posts/:slug/unlike", pathname);
        if (unlikeMatch) {
          if (method !== "POST") return json({ error: "Method not allowed" }, 405);
          return await handleUnlike(unlikeMatch.slug, env);
        }

        // /api/posts/:slug/likes (GET)
        const likesMatch = matchRoute("/api/posts/:slug/likes", pathname);
        if (likesMatch) {
          if (method !== "GET") return json({ error: "Method not allowed" }, 405);
          return await handleGetLikes(likesMatch.slug, env);
        }

        // /api/posts/:slug  (GET)
        const slugMatch = matchRoute("/api/posts/:slug", pathname);
        if (slugMatch) {
          if (method !== "GET") return json({ error: "Method not allowed" }, 405);
          return await handlePostBySlug(slugMatch.slug, env);
        }

        return json({ error: "Not found" }, 404);
      } catch (err) {
        return json({ error: err.message || "Internal server error" }, 500);
      }
    }

    // ---- Static assets (everything outside /api/) -------------------------
    return env.ASSETS.fetch(request);
  },
};
