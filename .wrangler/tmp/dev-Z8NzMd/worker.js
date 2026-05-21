var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/worker.js
var JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=60"
};
function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}
__name(json, "json");
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
__name(matchRoute, "matchRoute");
var cachedPosts = null;
async function loadPosts(env) {
  if (cachedPosts) return cachedPosts;
  const res = await env.ASSETS.fetch(new Request("http://faux/data/posts.json"));
  if (!res.ok) {
    throw new Error(`Failed to load posts.json: ${res.status}`);
  }
  cachedPosts = await res.json();
  return cachedPosts;
}
__name(loadPosts, "loadPosts");
var dbReady = false;
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
__name(ensureDB, "ensureDB");
async function getLikes(db, slug) {
  await ensureDB(db);
  const row = await db.prepare("SELECT likes FROM post_likes WHERE slug = ?").bind(slug).first();
  return row ? row.likes : 0;
}
__name(getLikes, "getLikes");
async function getAllLikes(db) {
  await ensureDB(db);
  const { results } = await db.prepare("SELECT slug, likes FROM post_likes").all();
  const map = /* @__PURE__ */ new Map();
  for (const row of results) {
    map.set(row.slug, row.likes);
  }
  return map;
}
__name(getAllLikes, "getAllLikes");
async function incrementLike(db, slug) {
  await ensureDB(db);
  await db.prepare(
    `INSERT INTO post_likes (slug, likes) VALUES (?, 1)
       ON CONFLICT(slug) DO UPDATE SET likes = likes + 1`
  ).bind(slug).run();
  const row = await db.prepare("SELECT likes FROM post_likes WHERE slug = ?").bind(slug).first();
  return row ? row.likes : 1;
}
__name(incrementLike, "incrementLike");
async function handleHealth(env) {
  const posts = await loadPosts(env);
  return json({ ok: true, postCount: posts.length });
}
__name(handleHealth, "handleHealth");
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
  const items = filtered.map((post) => {
    const { content, ...meta } = post;
    const out = full ? { ...meta, content } : meta;
    out.likes = likesMap.get(post.slug) || 0;
    return out;
  });
  return json({ posts: items, total, offset, limit: limit || total });
}
__name(handlePostList, "handlePostList");
async function handlePostBySlug(slug, env) {
  const posts = await loadPosts(env);
  const post = posts.find((p) => p.slug === slug);
  if (!post) {
    return json({ error: "Post not found" }, 404);
  }
  const likes = await getLikes(env.DB, slug);
  return json({ ...post, likes });
}
__name(handlePostBySlug, "handlePostBySlug");
async function handleGetLikes(slug, env) {
  const likes = await getLikes(env.DB, slug);
  return json({ slug, likes });
}
__name(handleGetLikes, "handleGetLikes");
async function handleLike(slug, env) {
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
__name(handleLike, "handleLike");
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;
    if (pathname.startsWith("/api/")) {
      if (method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, POST, OPTIONS",
            "access-control-allow-headers": "Content-Type"
          }
        });
      }
      try {
        if (pathname === "/api/health" && method === "GET") {
          return await handleHealth(env);
        }
        if (pathname === "/api/posts" && method === "GET") {
          return await handlePostList(url, env);
        }
        const likeMatch = matchRoute("/api/posts/:slug/like", pathname);
        if (likeMatch) {
          if (method !== "POST") return json({ error: "Method not allowed" }, 405);
          return await handleLike(likeMatch.slug, env);
        }
        const likesMatch = matchRoute("/api/posts/:slug/likes", pathname);
        if (likesMatch) {
          if (method !== "GET") return json({ error: "Method not allowed" }, 405);
          return await handleGetLikes(likesMatch.slug, env);
        }
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
    return env.ASSETS.fetch(request);
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-g95mZK/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-g95mZK/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
