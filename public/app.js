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
    history.replaceState(null, "", "#blog");
  } else {
    blogShell.classList.add("is-hidden");
    blogShell.setAttribute("data-hidden", "true");
    history.replaceState(null, "", location.pathname + location.search);
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

  filtered.forEach((post) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "post-card";
    btn.innerHTML = `
      <strong>${escapeHtml(post.title)}</strong>
      <span>${escapeHtml(post.excerpt || "")}</span>
      <span class="date">${escapeHtml(post.date)}</span>
    `;
    btn.addEventListener("click", () => renderPost(post.slug));
    postList.appendChild(btn);
  });

  const hasCurrent = filtered.some((p) => p.slug === state.currentSlug);
  if (!hasCurrent) renderPost(filtered[0].slug);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderPost(slug) {
  const post = state.posts.find((p) => p.slug === slug);
  if (!post) return;
  state.currentSlug = slug;

  postTitle.textContent = post.title;
  const tags = Array.isArray(post.tags) ? post.tags.join(", ") : "";
  postMeta.textContent = `${post.date} | ${categoryName(post.category)}${tags ? ` | ${tags}` : ""}`;

  try {
    postBody.innerHTML = marked.parse(post.content);
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
        ]
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

window.addEventListener("hashchange", () => {
  if (location.hash === "#blog" && state.view !== "blog") {
    enterBlogWithTheme(state.theme);
  }
});

async function init() {
  const res = await fetch("/data/posts.json");
  state.posts = await res.json();

  if (location.hash === "#blog") {
    enterBlogWithTheme(state.theme);
  } else {
    applyTheme();
  }
}

init().catch((err) => {
  postBody.textContent = `Failed to load: ${err.message}`;
});
