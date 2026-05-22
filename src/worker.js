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
//
//   GET  /images/:key             → serve image from R2 (public)
//   GET  /api/images              → list all images  [auth required]
//   POST /api/images              → upload image     [auth required]
//   GET  /api/images/:key/info    → image metadata   [auth required]
//   DELETE /api/images/:key       → delete image     [auth required]
//
//   *    everything else          → static assets via ASSETS binding
// ---------------------------------------------------------------------------

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=60",
};

const JSON_HEADERS_NO_CACHE = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "Content-Type, Authorization",
};

// Allowed image MIME types
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/avif",
  "image/heic",
  "image/heif",
]);

/** Respond with JSON */
function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

/** Respond with JSON (no-cache) */
function jsonNoCache(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS_NO_CACHE, ...extraHeaders },
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
// Auth helper — checks "Authorization: Bearer <secret>" header
// ---------------------------------------------------------------------------
function isAuthorized(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const secret = env.IMAGES_SECRET;
  if (!secret) return false; // secret must be configured
  return authHeader === `Bearer ${secret}`;
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
// Route handlers — Posts
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

  return new Response(JSON.stringify({ posts: items, total, offset, limit: limit || total }), {
    status: 200,
    headers: JSON_HEADERS_NO_CACHE,
  });
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
  return new Response(JSON.stringify({ slug, likes }), {
    status: 200,
    headers: JSON_HEADERS_NO_CACHE,
  });
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
// Route handlers — R2 Image Storage
// ---------------------------------------------------------------------------

/**
 * GET /images/:key
 * Public route — serves an image from R2 with caching headers.
 */
async function handleServeImage(key, request, env) {
  const object = await env.IMAGES.get(key);

  if (!object) {
    return new Response("Image not found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=86400, stale-while-revalidate=604800");

  // Support conditional requests (browser caching)
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(object.body, { headers });
}

/**
 * GET /api/images
 * List all images in the R2 bucket. Auth required.
 */
async function handleListImages(env) {
  const listed = await env.IMAGES.list();

  const images = listed.objects.map((obj) => ({
    key: obj.key,
    size: obj.size,
    uploaded: obj.uploaded,
    url: `/images/${encodeURIComponent(obj.key)}`,
    markdown: `![alt text](/images/${obj.key})`,
  }));

  return jsonNoCache({ images, count: images.length });
}

/**
 * POST /api/images
 * Upload an image. Expects multipart/form-data with a "file" field.
 * Optionally accepts a "key" field to set a custom filename.
 * Auth required.
 */
async function handleUploadImage(request, env) {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: "Expected multipart/form-data" }, 400);
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return json({ error: "Missing 'file' field in form data" }, 400);
  }

  // Validate content type
  const contentType = file.type || "application/octet-stream";
  if (!ALLOWED_IMAGE_TYPES.has(contentType.toLowerCase())) {
    return json({ error: `Unsupported image type: ${contentType}` }, 415);
  }

  // Determine storage key
  const customKey = formData.get("key");
  const key = (typeof customKey === "string" && customKey.trim())
    ? customKey.trim()
    : file.name;

  if (!key) {
    return json({ error: "Could not determine a key/filename for the image" }, 400);
  }

  // Upload to R2
  const arrayBuffer = await file.arrayBuffer();
  await env.IMAGES.put(key, arrayBuffer, {
    httpMetadata: { contentType },
  });

  return jsonNoCache({
    ok: true,
    key,
    size: arrayBuffer.byteLength,
    url: `/images/${encodeURIComponent(key)}`,
    markdown: `![alt text](/images/${key})`,
  }, 201);
}

/**
 * GET /api/images/:key/info
 * Return metadata for a single image. Auth required.
 */
async function handleImageInfo(key, env) {
  const object = await env.IMAGES.head(key);

  if (!object) {
    return json({ error: "Image not found" }, 404);
  }

  return jsonNoCache({
    key: object.key,
    size: object.size,
    uploaded: object.uploaded,
    etag: object.httpEtag,
    contentType: object.httpMetadata?.contentType,
    url: `/images/${encodeURIComponent(key)}`,
    markdown: `![alt text](/images/${key})`,
  });
}

/**
 * DELETE /api/images/:key
 * Delete an image from R2. Auth required.
 */
async function handleDeleteImage(key, env) {
  // Check object exists first
  const existing = await env.IMAGES.head(key);
  if (!existing) {
    return json({ error: "Image not found" }, 404);
  }

  await env.IMAGES.delete(key);
  return jsonNoCache({ ok: true, key });
}

// ---------------------------------------------------------------------------
// Main fetch handler
// ---------------------------------------------------------------------------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    // ---- CORS preflight (global) ------------------------------------------
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // ---- Public image serving: GET /images/:key ---------------------------
    if (method === "GET" && pathname.startsWith("/images/")) {
      const key = decodeURIComponent(pathname.slice("/images/".length));
      if (key) {
        try {
          return await handleServeImage(key, request, env);
        } catch (err) {
          return new Response("Error serving image", { status: 500 });
        }
      }
    }

    // ---- API routes -------------------------------------------------------
    if (pathname.startsWith("/api/")) {
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

        // ---- Image management API (all require auth) ----------------------

        // /api/images (GET = list, POST = upload)
        if (pathname === "/api/images") {
          if (!isAuthorized(request, env)) {
            return json({ error: "Unauthorized" }, 401, { "www-authenticate": "Bearer" });
          }
          if (method === "GET") return await handleListImages(env);
          if (method === "POST") return await handleUploadImage(request, env);
          return json({ error: "Method not allowed" }, 405);
        }

        // /api/images/:key/info (GET)
        const imageInfoMatch = matchRoute("/api/images/:key/info", pathname);
        if (imageInfoMatch) {
          if (!isAuthorized(request, env)) {
            return json({ error: "Unauthorized" }, 401, { "www-authenticate": "Bearer" });
          }
          if (method !== "GET") return json({ error: "Method not allowed" }, 405);
          return await handleImageInfo(imageInfoMatch.key, env);
        }

        // /api/images/:key (DELETE)
        const imageKeyMatch = matchRoute("/api/images/:key", pathname);
        if (imageKeyMatch) {
          if (!isAuthorized(request, env)) {
            return json({ error: "Unauthorized" }, 401, { "www-authenticate": "Bearer" });
          }
          if (method !== "DELETE") return json({ error: "Method not allowed" }, 405);
          return await handleDeleteImage(imageKeyMatch.key, env);
        }

        return json({ error: "Not found" }, 404);
      } catch (err) {
        return json({ error: err.message || "Internal server error" }, 500);
      }
    }

    // ---- Static assets (everything outside /api/ and /images/) -----------
    return env.ASSETS.fetch(request);
  },
};
