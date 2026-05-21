const state = {
  theme: "life",
  posts: [],
  currentSlug: null,
  view: "landing"
};

const blogShell = document.getElementById("blogShell");
const enterLife = document.getElementById("enterLife");
const enterElec = document.getElementById("enterElec");
const backHome = document.getElementById("backHome");
const skipToBlog = document.getElementById("skipToBlog");
const modeToggle = document.getElementById("modeToggle");
const sidebarTitle = document.getElementById("sidebarTitle");
const sidebarDesc = document.getElementById("sidebarDesc");
const postList = document.getElementById("postList");
const postTitle = document.getElementById("postTitle");
const postMeta = document.getElementById("postMeta");
const postBody = document.getElementById("postBody");
const yearEl = document.getElementById("year");
const landingThemePreview = document.getElementById("landingThemePreview");
const landingThemeLabel = document.getElementById("landingThemeLabel");
const iconSun = document.getElementById("iconSun");
const iconMoon = document.getElementById("iconMoon");
const likeRow = document.getElementById("likeRow");
const likeBtn = document.getElementById("likeBtn");
const likeCount = document.getElementById("likeCount");

if (yearEl) yearEl.textContent = String(new Date().getFullYear());

marked.setOptions({
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  }
});

function setView(view) {
  state.view = view;
  document.body.setAttribute("data-view", view);
  if (view === "blog") {
    blogShell.classList.remove("is-hidden");
    blogShell.removeAttribute("data-hidden");
    if (!location.hash.startsWith("#blog/")) {
      history.replaceState(null, "", "#blog");
    }
  } else {
    blogShell.classList.add("is-hidden");
    blogShell.setAttribute("data-hidden", "true");
    history.replaceState(null, "", location.pathname + location.search);
    document.title = "WILL'S BLOG";
  }
}

function enterBlogWithTheme(theme) {
  state.theme = theme;
  // Show blog shell before rendering: KaTeX / hljs can throw inside display:none
  setView("blog");
  requestAnimationFrame(() => {
    applyTheme();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function syncLandingThemeUI() {
  if (!landingThemePreview || !landingThemeLabel) return;
  const isElec = state.theme === "electronics";
  landingThemePreview.setAttribute("aria-pressed", isElec ? "true" : "false");
  landingThemePreview.title = isElec
    ? "Preview light background (stay on home)"
    : "Preview dark background (stay on home)";
  landingThemeLabel.textContent = isElec ? "Light preview" : "Dark preview";
  if (iconSun)  iconSun.style.display  = isElec ? "none" : "";
  if (iconMoon) iconMoon.style.display = isElec ? "" : "none";
}

function applyTheme() {
  const isLife = state.theme === "life";
  document.body.setAttribute("data-theme", isLife ? "life" : "electronics");
  modeToggle.textContent = isLife ? "Switch to electronics" : "Switch to life";
  sidebarTitle.textContent = isLife ? "Life" : "Electronics";
  sidebarDesc.textContent = isLife
    ? "Light theme for everyday notes."
    : "Dark theme for builds and math.";
  syncLandingThemeUI();
  if (state.view === "blog") {
    renderList();
  }
}

function categoryName(category) {
  return category === "life" ? "Life" : "Electronics";
}

function renderList() {
  const category = state.theme === "life" ? "life" : "electronics";
  const filtered = state.posts.filter((p) => p.category === category);
  postList.innerHTML = "";

  if (!filtered.length) {
    postList.innerHTML = "<p class=\"empty-hint\">No posts yet</p>";
    return;
  }

  filtered.forEach((post, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "post-card reveal";
    btn.style.setProperty("--d", `${index * 0.07}s`);
    btn.innerHTML = `
      <strong>${escapeHtml(post.title)}</strong>
      <span>${escapeHtml(post.excerpt || "")}</span>
      <span class="date">${escapeHtml(post.date)}</span>
    `;
    btn.addEventListener("click", () => {
      location.hash = `#blog/${post.slug}`;
    });
    postList.appendChild(btn);
  });

  const hasCurrent = filtered.some((p) => p.slug === state.currentSlug);
  if (hasCurrent && state.currentSlug) {
    renderPost(state.currentSlug);
  } else {
    renderPost(filtered[0].slug);
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ---------------------------------------------------------------------------
// Likes helpers
// ---------------------------------------------------------------------------
const LIKED_KEY = "blog_liked_posts";

function getLikedSlugs() {
  try {
    return JSON.parse(localStorage.getItem(LIKED_KEY) || "[]");
  } catch { return []; }
}

function markAsLiked(slug) {
  const liked = getLikedSlugs();
  if (!liked.includes(slug)) {
    liked.push(slug);
    localStorage.setItem(LIKED_KEY, JSON.stringify(liked));
  }
}

function unmarkAsLiked(slug) {
  const liked = getLikedSlugs().filter((s) => s !== slug);
  localStorage.setItem(LIKED_KEY, JSON.stringify(liked));
}

function hasLiked(slug) {
  return getLikedSlugs().includes(slug);
}

/** Update the like button UI for the current post */
function updateLikeUI(slug, likes) {
  likeRow.style.display = "";
  likeCount.textContent = String(likes);
  const liked = hasLiked(slug);
  likeBtn.classList.toggle("is-liked", liked);
  likeBtn.disabled = false;
  likeBtn.title = liked ? "Unlike this post" : "Like this post";
}

/** Fetch likes from API and update UI */
async function fetchLikes(slug) {
  try {
    const res = await fetch(`/api/posts/${encodeURIComponent(slug)}/likes`);
    if (!res.ok) return;
    const data = await res.json();
    updateLikeUI(slug, data.likes);
  } catch { /* silent */ }
}

/** Handle like/unlike button click */
async function handleLike() {
  const slug = state.currentSlug;
  if (!slug) return;

  const alreadyLiked = hasLiked(slug);
  const current = parseInt(likeCount.textContent, 10) || 0;

  if (alreadyLiked) {
    // --- Unlike (optimistic) ---
    unmarkAsLiked(slug);
    likeBtn.classList.remove("is-liked");
    likeBtn.title = "Like this post";
    const newCount = Math.max(0, current - 1);
    likeCount.textContent = String(newCount);
    updatePostCache(slug, newCount);

    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(slug)}/unlike`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        likeCount.textContent = String(data.likes);
        updatePostCache(slug, data.likes);
      }
    } catch { /* optimistic count stands */ }
  } else {
    // --- Like (optimistic) ---
    markAsLiked(slug);
    likeBtn.classList.add("is-liked", "like-pop");
    likeBtn.title = "Unlike this post";
    const newCount = current + 1;
    likeCount.textContent = String(newCount);
    updatePostCache(slug, newCount);

    // Remove pop animation class after it finishes
    setTimeout(() => likeBtn.classList.remove("like-pop"), 500);

    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(slug)}/like`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        likeCount.textContent = String(data.likes);
        updatePostCache(slug, data.likes);
      }
    } catch { /* optimistic count stands */ }
  }
}

/** Keep state.posts in sync so navigating back shows current count */
function updatePostCache(slug, likes) {
  const post = state.posts.find((p) => p.slug === slug);
  if (post) post.likes = likes;
}

likeBtn.addEventListener("click", handleLike);

// ---------------------------------------------------------------------------
// Render a single post
// ---------------------------------------------------------------------------
function renderPost(slug) {
  const post = state.posts.find((p) => p.slug === slug);
  if (!post) return;
  state.currentSlug = slug;

  postTitle.textContent = post.title;
  document.title = `${post.title} | WILL'S BLOG`;
  history.replaceState(null, "", `#blog/${slug}`);

  const tags = Array.isArray(post.tags) ? post.tags.join(", ") : "";
  postMeta.textContent = `${post.date} | ${categoryName(post.category)}${tags ? ` | ${tags}` : ""}`;

  // Show initial like count from list data, then refresh from API
  updateLikeUI(slug, post.likes || 0);
  fetchLikes(slug);

  try {
    // Extract math before Marked so it doesn't mangle _ as italic
    const mathBlocks = [];
    const protected_ = post.content
      .replace(/\$\$[\s\S]*?\$\$/g, (m) => { mathBlocks.push(m); return `%%MATH${mathBlocks.length - 1}%%`; })
      .replace(/\$[^\n$]+?\$/g,     (m) => { mathBlocks.push(m); return `%%MATH${mathBlocks.length - 1}%%`; });

    let html = marked.parse(protected_);
    mathBlocks.forEach((m, i) => { html = html.replace(`%%MATH${i}%%`, m); });

    postBody.innerHTML = html;
    postBody.querySelectorAll("pre code").forEach((el) => {
      try {
        hljs.highlightElement(el);
      } catch (_) {
        /* ignore single block errors */
      }
    });
    if (window.renderMathInElement) {
      window.renderMathInElement(postBody, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false }
        ],
        throwOnError: false
      });
    }
  } catch (err) {
    postBody.innerHTML = `<p class="render-error">Render error: ${escapeHtml(String(err.message))}</p>`;
  }
}

landingThemePreview?.addEventListener("click", () => {
  state.theme = state.theme === "life" ? "electronics" : "life";
  document.body.setAttribute("data-theme", state.theme === "life" ? "life" : "electronics");
  syncLandingThemeUI();
});

enterLife?.addEventListener("click", () => enterBlogWithTheme("life"));
enterElec?.addEventListener("click", () => enterBlogWithTheme("electronics"));

backHome?.addEventListener("click", () => {
  setView("landing");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

skipToBlog?.addEventListener("click", (e) => {
  e.preventDefault();
  enterBlogWithTheme(state.theme);
});

modeToggle.addEventListener("click", () => {
  state.theme = state.theme === "life" ? "electronics" : "life";
  applyTheme();
});

function handleHashChange() {
  if (location.hash.startsWith("#blog")) {
    const slug = location.hash.split("/")[1];
    let targetTheme = state.theme;
    
    if (slug) {
      const post = state.posts.find(p => p.slug === slug);
      if (post) {
        targetTheme = post.category === "life" ? "life" : "electronics";
        state.currentSlug = slug;
      }
    }
    
    if (state.view !== "blog" || state.theme !== targetTheme) {
      enterBlogWithTheme(targetTheme);
    } else {
      if (slug) renderPost(slug);
    }
  } else if (location.hash === "" || location.hash === "#") {
    if (state.view !== "landing") {
      setView("landing");
      document.title = "WILL'S BLOG";
    }
  }
}

window.addEventListener("hashchange", handleHashChange);

async function init() {
  const res = await fetch("/api/posts?fields=full");
  const data = await res.json();
  state.posts = data.posts;

  if (location.hash.startsWith("#blog")) {
    const slug = location.hash.split("/")[1];
    if (slug) {
      const post = state.posts.find(p => p.slug === slug);
      if (post) {
        state.theme = post.category === "life" ? "life" : "electronics";
        state.currentSlug = slug;
      }
    }
    enterBlogWithTheme(state.theme);
  } else {
    applyTheme();
  }
}

init().catch((err) => {
  postBody.textContent = `Failed to load: ${err.message}`;
});
