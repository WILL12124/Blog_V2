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

The site has two themes, toggled by the user at runtime:

| Token | Life (light/warm) | Electronics (dark/cyan) |
|---|---|---|
| Background | `#f7f4ef` | `#030712` |
| Accent | `#0d9488` teal | `#22d3ee` cyan |
| Glass surface | `rgba(255,255,255,0.52)` | `rgba(15,23,42,0.58)` |

Theme is applied by setting `data-theme="life"` or `data-theme="electronics"` on `<html>`. All theme-specific values are CSS custom properties defined in `styles.css` under the respective `[data-theme]` selectors. Post lists are filtered by category to match the active theme.

## Reversi Game

`public/reversi.html` + `public/js/reversi-engine.js` + `public/js/reversi-gadget.js` are a self-contained Reversi game (minimax + alpha-beta pruning + iterative deepening). The game is linked from the landing page and has no dependency on the blog's post system.
