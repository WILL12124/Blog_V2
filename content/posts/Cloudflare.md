---
title: "Intro to Cloudflare"
date: "2026-05-20"
category: "electronics"
excerpt: "A project enabling internet access in restricted regions using Cloudflare"
tags: ["Cloudflare", "Docs"]
---

Cloudflare is a powerful web deployment tool with a generous free tier that's perfect for beginners. This guide covers the essential concepts and products you need to know.

> **TL;DR** — Cloudflare lets you deploy websites, run serverless code, and store data at the edge — all for free at small scale. Start with **Pages** for static sites, **Workers** for backend logic, and **KV/D1/R2** for storage.

**Reference**: [Cloudflare Developers Docs](https://developers.cloudflare.com/)

---

## Table of Contents

1. [Foundational Concepts](#i-foundational-concepts) — Frontend, Backend, API, CDN, Edge Computing
2. [Developer Products](#ii-developer-products) — Workers, Pages, Images
3. [Product Comparison](#iii-quick-comparison) — At-a-glance table

---

## I. Foundational Concepts

Before diving into Cloudflare's products, here are a few key terms you'll see everywhere.

### Frontend

Everything the user sees, clicks, and interacts with. Built with three core technologies:

| Technology | Role | Example |
|:---|:---|:---|
| **HTML** | Structure | Text, images, links |
| **CSS** | Styling | Colors, fonts, layout |
| **JavaScript** | Logic | Clicks, data fetching, animations |

### Backend

The "brain" of the application running on a server. It handles business logic, database interactions, and user authentication.

### API (Application Programming Interface)

The messenger that allows the frontend to talk to the backend. It defines the rules for how data is requested and exchanged.

### CDN (Content Delivery Network)

A global network of servers designed to speed up website loading times. Instead of every user hitting one origin server, the CDN caches **static content** (images, CSS, videos) on servers worldwide. Visitors automatically get content from the nearest server — reducing latency and improving performance.

### Edge Computing

Similar to CDN, but instead of caching just static content, edge computing allows developers to **run code** on servers close to the user. This is the core idea behind most of Cloudflare's developer products.

---

## II. Developer Products

Below are the most popular products Cloudflare has to offer.

### Workers — Serverless Edge Computing

> [Workers Docs](https://developers.cloudflare.com/workers/) · [My Edgetunnel Project](/posts/edgetunnel)

A **serverless computing platform** that uses a V8 engine to run JavaScript and TypeScript at the edge. Workers can be used to build APIs, webhooks, middleware, and full-stack apps — with much faster response times compared to traditional centralized servers.

Workers come with several powerful companion services:

#### KV — Key-Value Storage

Low-latency key-value storage designed for extremely fast reads at the edge. Best suited for data that is **read frequently but updated infrequently** — think configuration, feature flags, or cached API responses.

#### D1 — SQL Database

A serverless SQL database deployed at the edge. Supports complex queries and full-text search. Good for dynamic websites that need to store **structured, relational data** like user accounts or blog posts.

#### R2 — Object Storage

A serverless object storage service with **zero egress fees**. Ideal for storing large files such as images, videos, and backups — without worrying about bandwidth costs.

#### Wrangler — CLI Tool

A command-line tool for building, testing, and deploying applications to Cloudflare. Handles local development, environment management, and production deploys all in one.

```bash
# Get started with Wrangler
npm install -g wrangler
wrangler login
wrangler init my-project
```

#### Workers AI — Inference at the Edge

Cloudflare's inference platform that lets you run machine learning models directly at the edge. Supports popular open-source models for text generation, image classification, translation, and embeddings — all without managing GPU infrastructure.

---

### Pages — Frontend Deployment

> [Pages Docs](https://developers.cloudflare.com/pages/)

A global deployment platform for **frontend applications and static sites**. Pages is free to use and integrates directly with your GitHub or GitLab repository — push a commit and your site is automatically built and deployed to Cloudflare's edge network.

**Key features:**
- Git-based deployments (push to deploy)
- Preview URLs for every pull request
- Built-in CI/CD pipeline
- Custom domain support with free SSL

---

### Images — Media Optimization

> [Images Docs](https://developers.cloudflare.com/images/)

A platform for storing, optimizing, and serving images from the edge. With Images, you can **dynamically resize, compress, and transform images** in real time — without manually creating or storing multiple copies for different use cases, browsers, or device breakpoints.

---

## III. Quick Comparison

| Product | Type | Best For | Free Tier |
|:---|:---|:---|:---|
| **Workers** | Compute | APIs, middleware, full-stack apps | 100K requests/day |
| **KV** | Key-Value Store | Config, feature flags, caching | 100K reads/day |
| **D1** | SQL Database | Relational data, user accounts | 5M rows read/day |
| **R2** | Object Storage | Images, videos, backups | 10 GB storage |
| **Pages** | Hosting | Static sites, SPAs | Unlimited requests |
| **Images** | Media | Image optimization & delivery | Paid only |
