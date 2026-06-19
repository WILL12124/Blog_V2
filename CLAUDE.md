# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run build:posts  # Compile Markdown posts → public/data/posts.json
npm run dev          # Build posts + start local Wrangler dev server
npm run deploy       # Build posts + deploy to Cloudflare Workers
```

First-time deploy requires `npx wrangler login` before `npm run deploy`.

## Architecture

**Personal blog** deployed on Cloudflare Workers with a static-first SPA approach.

**Build pipeline:**
1. Markdown files with YAML frontmatter in `content/posts/` are compiled by `scripts/build-posts.mjs` (uses `gray-matter`) into `public/data/posts.json`
2. `src/worker.js` is a minimal Cloudflare Worker that serves static assets from `public/` via the `ASSETS` binding
3. `public/app.js` is a client-side SPA that fetches `posts.json` at runtime and renders posts using Marked (markdown), Highlight.js (code), and KaTeX (LaTeX math) — all loaded from CDN

**Key files:**
- `public/app.js` — all client-side state, routing, and rendering logic
- `public/styles.css` — full design system (~1,450 lines), dual-theme tokens, glassmorphism effects
- `scripts/build-posts.mjs` — post compiler; always run before serving/deploying
- `public/data/posts.json` — generated artifact; do not edit by hand


## API Routes

The worker exposes dynamic API endpoints under `/api/`:

| Route | Method | Description |
|---|---|---|
| `/api/health` | GET | Health check; returns `{ ok, postCount }` |
| `/api/posts` | GET | Post list with optional query params |
| `/api/posts/:slug` | GET | Single post with full content + likes |
| `/api/posts/:slug/likes` | GET | Get like count for a post |
| `/api/posts/:slug/like` | POST | Increment like count, returns `{ slug, likes }` |
| `/api/posts/:slug/unlike` | POST | Decrement like count (floor 0), returns `{ slug, likes }` |
| `/images/:key` | GET | Serve image from R2 (public, cached 24h) |
| `/api/images` | GET | List all R2 images — **auth required** |
| `/api/images` | POST | Upload image (multipart/form-data) — **auth required** |
| `/api/images/:key` | DELETE | Delete an image from R2 — **auth required** |
| `/api/images/:key/info` | GET | Image metadata — **auth required** |

**`/api/posts` query parameters:**
- `category` — filter by `"life"` or `"electronics"`
- `limit` — max number of results (default: all)
- `offset` — skip N results (default: 0)
- `fields=full` — include post body content (default: metadata only)

Response shape: `{ posts: [...], total, offset, limit }` — each post includes a `likes` field.

## D1 Database (Likes)

Likes are stored in a Cloudflare D1 database (`blog-likes`) with a `post_likes` table. The table is auto-created on first request.

**First-time production deploy:**
1. `npx wrangler d1 create blog-likes` — creates the database
2. Copy the output `database_id` into `wrangler.toml`
3. `npx wrangler d1 execute blog-likes --remote --file=./migrations/0001_create_likes.sql` — run migration

Local dev uses a local SQLite file automatically; no setup needed.

## R2 Image Storage

Images are stored in a Cloudflare R2 bucket (`blog-images`) and served via the worker at `/images/:key`.

**First-time setup:**
1. Enable R2 in the Cloudflare Dashboard (Storage & Databases → R2)
2. `npx wrangler r2 bucket create blog-images` — creates the bucket
3. `npx wrangler secret put IMAGES_SECRET` — set a strong secret token for the admin API

**Admin panel:** `/admin.html` — drag-and-drop upload, gallery view, one-click markdown copy, delete.

**Auth:** All `/api/images` routes require `Authorization: Bearer <IMAGES_SECRET>` header.
The admin panel stores the token in sessionStorage (cleared when the tab closes).

**Referencing images in posts:**
```markdown
![Description](/images/filename.jpg)
```
The worker proxies this from R2 with `Cache-Control: public, max-age=86400`.

**Uploading via CLI (alternative to admin UI):**
```bash
npx wrangler r2 object put blog-images/filename.jpg --file=./path/to/file.jpg
```


## Content

Posts are Markdown files in `content/posts/` with this frontmatter:

```yaml
---
title: "Post Title"
date: "2026-04-09"
category: "life"       # or "electronics" — auto-inferred from filename prefix if omitted
excerpt: "Short summary"
tags: ["tag1", "tag2"]
---
```

Category is auto-inferred: filenames starting with `life-` → `"life"`, all others → `"electronics"`.

After adding or editing a post, run `npm run build:posts` to regenerate `public/data/posts.json`.

## Theme System

The site has two **independent** axes:

### Space (post category)
Controls which posts are shown in the sidebar. Set via `state.space`.
- **`"life"`** — shows Life posts; sidebar label reads "Life"
- **`"electronics"`** — shows Electronics posts; sidebar label reads "Electronics"

### Dark Mode (visual appearance)
Controls the visual light/dark appearance. Set via `state.darkMode` (boolean), persisted to `localStorage` under key `blog_dark_mode`.
- **`false` (light)** — sets `data-theme="life"` on `<body>` (warm paper background, teal accent)
- **`true` (dark)** — sets `data-theme="electronics"` on `<body>` (OLED dark, cyan accent)

| Token | Light (`data-theme="life"`) | Dark (`data-theme="electronics"`) |
|---|---|---|
| Background | `#f7f4ef` | `#030712` |
| Accent | `#0d9488` teal | `#22d3ee` cyan |
| Glass surface | `rgba(255,255,255,0.52)` | `rgba(15,23,42,0.58)` |

### Controls
- **Blog header — moon/sun icon button** (`#darkModeToggle`): toggles `darkMode` independently
- **Blog header — "Switch to Life/Electronics" button** (`#spaceToggle`): switches the post space independently
- **Landing — dark/light preview button** (`#landingThemePreview`): toggles `darkMode` without entering the blog
- **Landing — "Life" / "Electronics" cards**: enter the blog in the respective space (dark mode unchanged)


## Reversi Game

`public/reversi.html` + `public/js/reversi-engine.js` + `public/js/reversi-gadget.js` are a self-contained Reversi game (minimax + alpha-beta pruning + iterative deepening). The game is linked from the landing page and has no dependency on the blog's post system.
