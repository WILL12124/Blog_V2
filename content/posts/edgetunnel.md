---
title: "Edgetunnel"
date: "2026-04-22"
category: "electronics"
excerpt: "A project enabling internet access in restricted regions using Cloudflare"
tags: ["Cloudflare", "Proxy"]
---

I built my own proxy to bypass the GFW using Cloudflare Workers and KV. The project is open-source and available on GitHub.

> **TL;DR** — Edgetunnel is a proxy running on Cloudflare Workers. It's free, serverless, and requires no dedicated server. However, it is not very stable and may expose what site you are visiting.

**Reference**: [github.com/cmliu/edgetunnel](https://github.com/cmliu/edgetunnel)

---

![alt text](/images/edgetunnel.png)

## Table of Contents

1. [Background](#i-background) — Why I built this and what problem it solves
2. [Setup](#ii-setup) — Getting it running on your own account
3. [Drawbacks](#iii-drawbacks) — What to watch out for

---

## I. Background

The Great Firewall (GFW) in China blocks many websites and services, making it hard to access the open internet. While commercial VPNs exist, they are often unreliable and can be blocked or throttled.

I built this project to find a backup solution. Cloudflare Workers lets you run code globally on their edge network, which has IPs that are generally not blocked by the GFW.

By routing VLESS traffic through a Worker, you can create a lightweight, serverless proxy that's fast, reliable, and free to run at small scale.

---

## II. Setup

Reference: [YouTube:2026 最强 Cloudflare 免费VPN自建](https://www.youtube.com/watch?v=chcFg878840)

### Prerequisites

- A free Cloudflare account
- A custom domain added to Cloudflare

### Deployment Steps

```bash
# 1. Fork the repository on GitHub
# 2. In Cloudflare Dashboard → Workers & Pages → Create Worker

# 3. Deploy worker
```

**Key settings to configure:**

- Set your **UUID** as a KV value (used to authenticate clients)
- Bind your KV namespace to the Worker under `Settings → Variables`
- Add a custom domain to the Worker. **Avoid using free subdomains which may cause the worker being blocked or data leaked.**

## III. Drawbacks

EdgeTunnel's performance heavily depends on the "Preferred IP" (优选IP) configuration — in my experience, connection drops and instability are common.

Additionally, since the proxy itself runs on Cloudflare's infrastructure, it cannot directly access other Cloudflare-hosted domains such as Discord, Shopify, or even this website. To work around this, EdgeTunnel's developers route traffic to these destinations through third-party IPs of unknown origin. While HTTPS encryption protects the content of your requests, your browsing patterns and visited domains may still be exposed to whoever operates those IPs.
