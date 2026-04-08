# Personal Glass Blog on Cloudflare Workers

一个基于 Cloudflare Workers 的个人博客模板，支持：

- 生活与电子项目双页面切换
- 主题联动（生活亮色 / 电子项目暗色）
- Glassmorphism 风格
- Markdown 发文
- 代码高亮（highlight.js）
- LaTeX 渲染（KaTeX）

## 1) 安装

```bash
npm install
```

## 2) 写文章

在 `content/posts` 新建 `.md` 文件，示例：

```md
---
title: "标题"
date: "2026-04-07"
category: "life" # life 或 electronics
excerpt: "摘要"
tags: ["标签1", "标签2"]
---

正文（支持 markdown / 代码块 / latex）
```

## 3) 构建内容

```bash
npm run build:posts
```

会生成 `public/data/posts.json`，部署后直接可访问。

## 4) 本地预览

```bash
npm run dev
```

## 5) 部署到 Cloudflare Worker

1. 登录 Cloudflare：
   ```bash
   npx wrangler login
   ```
2. 发布：
   ```bash
   npm run deploy
   ```

## 6) 绑定你的域名

在 Cloudflare 控制台 -> Workers -> 该服务 -> Triggers -> Custom Domains，
绑定你已经托管在 Cloudflare 的域名即可。
