// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const DARK_MODE_KEY = "blog_dark_mode";

const state = {
  space: "life",      // "life" | "electronics" — which post category is shown
  darkMode: false,    // independent light/dark preference
  posts: [],
  currentSlug: null,
  view: "landing"
};

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------
const blogShell        = document.getElementById("blogShell");
const enterLife        = document.getElementById("enterLife");
const enterElec        = document.getElementById("enterElec");
const backHome         = document.getElementById("backHome");
const skipToBlog       = document.getElementById("skipToBlog");
const spaceToggle      = document.getElementById("spaceToggle");
const darkModeToggle   = document.getElementById("darkModeToggle");
const blogIconSun      = document.getElementById("blogIconSun");
const blogIconMoon     = document.getElementById("blogIconMoon");
const sidebarTitle     = document.getElementById("sidebarTitle");
const sidebarDesc      = document.getElementById("sidebarDesc");
const postList         = document.getElementById("postList");
const postTitle        = document.getElementById("postTitle");
const postMeta         = document.getElementById("postMeta");
const postBody         = document.getElementById("postBody");
const yearEl           = document.getElementById("year");
const landingThemePreview = document.getElementById("landingThemePreview");
const landingThemeLabel   = document.getElementById("landingThemeLabel");
const iconSun          = document.getElementById("iconSun");
const iconMoon         = document.getElementById("iconMoon");
const likeRow          = document.getElementById("likeRow");
const likeBtn          = document.getElementById("likeBtn");
const likeCount        = document.getElementById("likeCount");
const drawerToggle     = document.getElementById("drawerToggle");
const sidebarClose     = document.getElementById("sidebarClose");
const sidebarBackdrop  = document.getElementById("sidebarBackdrop");
const blogSidebar      = document.getElementById("blogSidebar");

if (yearEl) yearEl.textContent = String(new Date().getFullYear());

marked.setOptions({
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  }
});

// ---------------------------------------------------------------------------
// Dark mode — persisted independently of space
// ---------------------------------------------------------------------------
function loadDarkModePreference() {
  try {
    const saved = localStorage.getItem(DARK_MODE_KEY);
    if (saved !== null) return saved === "true";
  } catch { /* ignore */ }
  return false; // default: light
}

function saveDarkModePreference(value) {
  try { localStorage.setItem(DARK_MODE_KEY, String(value)); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Apply the visual theme to <body> based solely on darkMode
// ---------------------------------------------------------------------------
function applyDarkMode() {
  // "life" data-theme = light, "electronics" = dark
  // We keep using these same CSS tokens — just driven by darkMode, not space
  document.body.setAttribute("data-theme", state.darkMode ? "electronics" : "life");

  // Blog header icons
  if (blogIconSun)  blogIconSun.style.display  = state.darkMode ? "" : "none";
  if (blogIconMoon) blogIconMoon.style.display = state.darkMode ? "none" : "";

  // Landing preview button
  syncLandingThemeUI();
}

// ---------------------------------------------------------------------------
// Sync landing page dark/light preview button
// ---------------------------------------------------------------------------
function syncLandingThemeUI() {
  if (!landingThemePreview || !landingThemeLabel) return;
  landingThemePreview.setAttribute("aria-pressed", state.darkMode ? "true" : "false");
  landingThemePreview.title = state.darkMode
    ? "Switch to light mode (preview)"
    : "Switch to dark mode (preview)";
  landingThemeLabel.textContent = state.darkMode ? "Light mode" : "Dark mode";
  if (iconSun)  iconSun.style.display  = state.darkMode ? "" : "none";
  if (iconMoon) iconMoon.style.display = state.darkMode ? "none" : "";
}

// ---------------------------------------------------------------------------
// Apply the space (post category) to sidebar labels and re-render list
// ---------------------------------------------------------------------------
function applySpace() {
  const isLife = state.space === "life";
  if (spaceToggle) {
    spaceToggle.textContent = isLife ? "Switch to Electronics" : "Switch to Life";
  }
  sidebarTitle.textContent = isLife ? "Life" : "Electronics";
  sidebarDesc.textContent  = isLife
    ? "Everyday notes, ideas & routines."
    : "Builds, schematics, code & math.";

  if (state.view === "blog") {
    renderList();
  }
}

// ---------------------------------------------------------------------------
// Combined full theme + space update
// ---------------------------------------------------------------------------
function applyAll() {
  applyDarkMode();
  applySpace();
}

// ---------------------------------------------------------------------------
// View management
// ---------------------------------------------------------------------------
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

function enterBlogWithSpace(space) {
  state.space = space;
  // Show blog shell before rendering: KaTeX / hljs can throw inside display:none
  setView("blog");
  requestAnimationFrame(() => {
    applyAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
function categoryName(category) {
  return category === "life" ? "Life" : "Electronics";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ---------------------------------------------------------------------------
// Render post list in sidebar
// ---------------------------------------------------------------------------
function renderList() {
  const filtered = state.posts.filter((p) => p.category === state.space);
  postList.innerHTML = "";

  if (!filtered.length) {
    postList.innerHTML = "<p class=\"empty-hint\">No posts yet</p>";
    return;
  }

  filtered.forEach((post, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "post-card reveal";
    btn.dataset.slug = post.slug;
    btn.style.setProperty("--d", `${index * 0.07}s`);
    btn.innerHTML = `
      <strong>${escapeHtml(post.title)}</strong>
      <span>${escapeHtml(post.excerpt || "")}</span>
      <span class="date">${escapeHtml(post.date)}</span>
    `;
    btn.addEventListener("click", () => {
      location.hash = `#blog/${post.slug}`;
      closeSidebar();
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
    const res = await fetch(`/api/posts/${encodeURIComponent(slug)}/likes`, { cache: "no-store" });
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
// Drawer (mobile sidebar) helpers
// ---------------------------------------------------------------------------
function openSidebar() {
  if (!blogSidebar) return;
  blogSidebar.classList.add("is-open");
  sidebarBackdrop.classList.add("is-visible");
  document.body.style.overflow = "hidden";
}

function closeSidebar() {
  if (!blogSidebar) return;
  blogSidebar.classList.remove("is-open");
  sidebarBackdrop.classList.remove("is-visible");
  document.body.style.overflow = "";
}

drawerToggle?.addEventListener("click", openSidebar);
sidebarClose?.addEventListener("click", closeSidebar);
sidebarBackdrop?.addEventListener("click", closeSidebar);

// ---------------------------------------------------------------------------
// Render a single post
// ---------------------------------------------------------------------------
function renderPost(slug) {
  const post = state.posts.find((p) => p.slug === slug);
  if (!post) return;
  state.currentSlug = slug;

  // Highlight the active post card in the sidebar
  document.querySelectorAll(".post-card").forEach((card) => {
    card.classList.toggle("is-active", card.dataset.slug === slug);
  });

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

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

// Landing: dark/light preview toggle (does NOT navigate to blog)
landingThemePreview?.addEventListener("click", () => {
  state.darkMode = !state.darkMode;
  saveDarkModePreference(state.darkMode);
  applyDarkMode();
});

// Landing: enter a space
enterLife?.addEventListener("click", () => enterBlogWithSpace("life"));
enterElec?.addEventListener("click", () => enterBlogWithSpace("electronics"));

// Blog: back to home
backHome?.addEventListener("click", () => {
  setView("landing");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// Blog: "Read blog" link from landing (skips to blog with current space)
skipToBlog?.addEventListener("click", (e) => {
  e.preventDefault();
  enterBlogWithSpace(state.space);
});

// Blog header: toggle space (Life ↔ Electronics)
spaceToggle?.addEventListener("click", () => {
  state.space = state.space === "life" ? "electronics" : "life";
  applySpace();
});

// Blog header: toggle dark mode (light ↔ dark)
darkModeToggle?.addEventListener("click", () => {
  state.darkMode = !state.darkMode;
  saveDarkModePreference(state.darkMode);
  applyDarkMode();
});

// ---------------------------------------------------------------------------
// Hash-based routing
// ---------------------------------------------------------------------------
function handleHashChange() {
  if (location.hash.startsWith("#blog")) {
    const slug = location.hash.split("/")[1];
    let targetSpace = state.space;

    if (slug) {
      const post = state.posts.find(p => p.slug === slug);
      if (post) {
        // Navigate to the correct space for this post
        targetSpace = post.category === "life" ? "life" : "electronics";
        state.currentSlug = slug;
      }
    }

    if (state.view !== "blog" || state.space !== targetSpace) {
      enterBlogWithSpace(targetSpace);
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

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
async function init() {
  // Load persisted dark mode preference
  state.darkMode = loadDarkModePreference();
  applyDarkMode();

  const res = await fetch("/api/posts?fields=full");
  const data = await res.json();
  state.posts = data.posts;

  if (location.hash.startsWith("#blog")) {
    const slug = location.hash.split("/")[1];
    if (slug) {
      const post = state.posts.find(p => p.slug === slug);
      if (post) {
        state.space = post.category === "life" ? "life" : "electronics";
        state.currentSlug = slug;
      }
    }
    enterBlogWithSpace(state.space);
  } else {
    applyAll();
  }
}

init().catch((err) => {
  postBody.textContent = `Failed to load: ${err.message}`;
});
