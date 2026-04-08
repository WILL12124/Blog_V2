# Personal glass blog (Cloudflare Workers)

Static-first personal blog template:

- **Life** vs **electronics** sections with matching light/dark themes
- Glassmorphism-style UI
- Markdown posts, code highlighting (Highlight.js), LaTeX (KaTeX)

## 1) Install

```bash
npm install
```

## 2) Write posts

Add `.md` files under `content/posts`, for example:

```md
---
title: "Title"
date: "2026-04-07"
category: "life" # life | electronics
excerpt: "Short summary"
tags: ["tag1", "tag2"]
---

Body (markdown, code fences, LaTeX)
```

## 3) Build the index

```bash
npm run build:posts
```

Writes `public/data/posts.json` for the site to load.

## 4) Local preview

```bash
npm run dev
```

## 5) Deploy (Worker)

1. Log in to Cloudflare:
   ```bash
   npx wrangler login
   ```
2. Deploy:
   ```bash
   npm run deploy
   ```

## 6) Custom domain

In Cloudflare: **Workers** → your worker → **Triggers** → **Custom Domains**, and attach the domain you already proxy on Cloudflare.
