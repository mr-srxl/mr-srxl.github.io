(function () {
  "use strict";

  /* ============================================================
     APP REGISTRY
     ============================================================ */
  const APPS = {
    about:    { title: "About",    icon: "fas fa-user-secret", url: "apps/about.html" },
    learning: { title: "Path",     icon: "fas fa-folder-open", url: "apps/learning.html" },
    skills:   { title: "Skills",   icon: "fas fa-code",        url: "apps/skills.html" },
    python:   { title: "Python",   icon: "fab fa-python",      url: "apps/python/index.html" },
    blog:     { title: "Notes",    icon: "fas fa-feather",     url: "apps/blog/index.html" },
    gallery:  { title: "Gallery",  icon: "fas fa-images",      url: "apps/gallery.html" },
    terminal: { title: "Terminal", icon: "fas fa-terminal",    url: null, terminal: true },
    settings: { title: "Settings", icon: "fas fa-gear",        url: "apps/settings.html" }
  };

  const desk    = document.getElementById("desktop");
  const taskbar = document.getElementById("taskbar-items");
  const winHost = document.getElementById("windows-container");
  const openApps = new Map();
  let zIndex = 100, cascade = 0, activeAppId = null;

  /* ============================================================
     SETTINGS
     ============================================================ */
  const SETTINGS_DEFAULTS = {
    accent: "default", motion: "full", wallpaper: "auto", termSize: "medium"
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem("srxl-settings");
      return Object.assign({}, SETTINGS_DEFAULTS, raw ? JSON.parse(raw) : {});
    } catch (e) { return Object.assign({}, SETTINGS_DEFAULTS); }
  }
  function saveSettings(s) {
    try { localStorage.setItem("srxl-settings", JSON.stringify(s)); } catch (e) {}
  }
  function applySetting(key, value) {
    const html = document.documentElement;
    const s = loadSettings();
    s[key] = value;
    saveSettings(s);
    if (key === "accent") {
      if (value === "default") delete html.dataset.accent;
      else html.dataset.accent = value;
    } else if (key === "motion") {
      if (value === "reduced") html.dataset.motion = "reduced";
      else delete html.dataset.motion;
    } else if (key === "wallpaper") {
      if (value === "auto") delete html.dataset.wallpaper;
      else html.dataset.wallpaper = value;
    } else if (key === "termSize") {
      if (value === "medium") delete html.dataset.termSize;
      else html.dataset.termSize = value;
    }
  }

  /* ============================================================
     BOOT
     ============================================================ */
  const bootScreen    = document.getElementById("boot-screen");
  const loadingScreen = document.getElementById("loading-screen");
  const winLoader     = document.getElementById("win-loader");
  const linuxLoader   = document.getElementById("linux-loader");
  const LINUX_LINES = [
    "Started Initialize Hardware.",
    "Reached target Local File Systems.",
    "Starting Load/Save Random Seed...",
    "Starting Network Manager...",
    "Started Quiet Focus Service.",
    "Started Notes & Notebooks Daemon.",
    "Reached target Multi-User System.",
    "Welcome to SRXL Linux v1.0"
  ];

  document.querySelectorAll(".os-card").forEach(function (card) {
    card.addEventListener("click", function () { startLoading(card.dataset.os); });
  });

  function startLoading(os) {
    bootScreen.classList.add("hide");
    setTimeout(function () {
      loadingScreen.classList.add("show");
      if (os === "windows") {
        winLoader.classList.add("show");
        setTimeout(finish, 2600);
      } else {
        linuxLoader.classList.add("show");
        renderLinuxBoot(function () { setTimeout(finish, 600); });
      }
      function finish() {
        if (os === "linux") document.body.classList.add("linux-mode");
        desk.classList.add("show");
        startClock();
        loadingScreen.classList.add("hide");
        setTimeout(function () {
          loadingScreen.classList.remove("show", "hide");
        }, 750);
      }
    }, 440);
  }

  function renderLinuxBoot(done) {
    let i = 0; linuxLoader.innerHTML = "";
    (function next() {
      if (i >= LINUX_LINES.length) { done(); return; }
      const last = i === LINUX_LINES.length - 1;
      const line = document.createElement("div");
      line.className = "line" + (last ? " welcome" : "");
      line.innerHTML = last ? LINUX_LINES[i]
        : "[ <span class='ok'>  OK  </span> ] " + LINUX_LINES[i];
      linuxLoader.appendChild(line); i++;
      setTimeout(next, last ? 420 : 175);
    })();
  }

  /* ============================================================
     WINDOW MANAGEMENT
     ============================================================ */
  async function openApp(id, triggerEl) {
    if (!APPS[id]) return;
    if (openApps.has(id)) {
      const existing = openApps.get(id);
      existing.classList.remove("minimized");
      focusApp(id);
      return;
    }
    const meta = APPS[id];
    const isLinux = document.body.classList.contains("linux-mode");
    let title = meta.title;
    if (meta.terminal) title = isLinux ? "Terminal" : "PowerShell";

    const win = document.createElement("div");
    win.className = "window";
    win.dataset.app = id;

    // Reading surface for all apps except the terminal
    if (id !== "terminal") win.classList.add("window--reading");

    win.setAttribute("tabindex", "-1");
    win.setAttribute("tabindex", "-1");
    win.setAttribute("role", "dialog");
    win.setAttribute("aria-label", title);
    win._trigger = triggerEl || document.activeElement;

    const isMobile = window.matchMedia("(max-width: 760px)").matches;
    const offset = (cascade++ % 5) * 34;
    win.style.left = (isMobile ? 0 : 90 + offset) + "px";
    win.style.top  = (isMobile ? 0 : 64 + offset) + "px";
    win.style.zIndex = ++zIndex;

    win.innerHTML =
      '<div class="window-header" data-drag>' +
        '<div class="window-title"><i class="' + meta.icon + '"></i><span>' + title + '</span></div>' +
        '<div class="window-controls">' +
          '<button class="ctrl min" aria-label="Minimize"><i class="fas fa-minus"></i></button>' +
          '<button class="ctrl max" aria-label="Maximize"><i class="fas fa-expand"></i></button>' +
          '<button class="ctrl close" aria-label="Close"><i class="fas fa-xmark"></i></button>' +
        '</div>' +
      '</div>' +
      '<div class="window-body' + (meta.terminal ? " terminal" : "") + '"></div>';

    const body = win.querySelector(".window-body");
    winHost.appendChild(win);
    openApps.set(id, win);

    if (location.hash !== "#app/" + id) {
      history.replaceState(null, "", "#app/" + id);
    }

    if (meta.terminal) {
      runTerminal(body, isLinux ? "linux" : "windows");
    } else {
      await loadIntoWindow(body, meta.url);
    }

    win.querySelector(".close").addEventListener("click", function (e) {
      e.stopPropagation(); closeApp(id);
    });
    win.querySelector(".min").addEventListener("click", function (e) {
      e.stopPropagation(); win.classList.add("minimized"); setActiveTask(null);
    });
    win.querySelector(".max").addEventListener("click", function (e) {
      e.stopPropagation();
      const wasMax = win.classList.contains("maximized");
      win.classList.remove("snap-left", "snap-right");
      if (wasMax) win.classList.remove("maximized");
      else win.classList.add("maximized");
      const icon = win.querySelector(".max i");
      icon.className = win.classList.contains("maximized") ? "fas fa-compress" : "fas fa-expand";
    });
    win.addEventListener("mousedown", function () { focusApp(id); });
    makeDraggable(win, win.querySelector("[data-drag]"));
    addTaskItem(id, { title: title, icon: meta.icon });
    focusApp(id);
    win.focus();
  }

  /* ============================================================
     APP CONTENT LOADING
     ============================================================ */
  async function loadIntoWindow(body, url) {
    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      body.innerHTML = await res.text();
      body.scrollTop = 0;
      enhanceContent(body, url);
    } catch (err) {
      showToast("Failed to load: " + err.message, "error");
      body.innerHTML =
        '<div class="load-error">' +
          '<h3>Couldn\'t load this section</h3>' +
          '<p>This site uses <code>fetch()</code> to load content, which requires a web server.</p>' +
          '<p class="small">Locally, run: <code>python -m http.server 8000</code><br>then open <code>http://localhost:8000</code></p>' +
          '<p class="small">Error: ' + err.message + '</p>' +
        '</div>';
    }
  }

  function enhanceContent(root, url) {
    wireInternalLinks(root, url);
    highlightAllCode(root);
    injectCopyButtons(root);
    initBlog(root);
    initSettings(root);
    initPyodide(root, url);
  }

  function wireInternalLinks(root, url) {
    root.querySelectorAll("a[data-internal]").forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        loadIntoWindow(root, link.getAttribute("href"));
      });
    });
  }

  /* ============================================================
     SYNTAX HIGHLIGHTING
     ============================================================ */
  function highlightAllCode(root) {
    const hasHljs = typeof window.hljs !== "undefined";

    root.querySelectorAll(".code pre").forEach(function (pre) {
      if (pre.dataset.hljsDone === "1") return;
      const wrapper = pre.closest(".code");
      const lang = (wrapper && wrapper.dataset.lang) ? wrapper.dataset.lang : "python";
      const plainText = pre.textContent;
      const code = document.createElement("code");
      code.className = "language-" + lang;
      code.textContent = plainText;
      pre.innerHTML = "";
      pre.appendChild(code);
      pre.dataset.hljsDone = "1";
      if (hasHljs) window.hljs.highlightElement(code);
    });

    root.querySelectorAll("pre > code").forEach(function (code) {
      if (code.dataset.hljsDone === "1") return;
      code.dataset.hljsDone = "1";
      if (hasHljs) window.hljs.highlightElement(code);
    });
  }

  /* ============================================================
     COPY BUTTONS (read-only blocks only)
     ============================================================ */
  function injectCopyButtons(root) {
    root.querySelectorAll(".code").forEach(function (block) {
      // Python blocks are handled by the editable code editor
      if (block.dataset.lang === "python") return;
      if (block.querySelector(".code-copy")) return;

      const btn = document.createElement("button");
      btn.className = "code-copy";
      btn.setAttribute("aria-label", "Copy code");
      btn.innerHTML = '<i class="fas fa-copy"></i>';
      btn.addEventListener("click", async function (e) {
        e.stopPropagation();
        const pre = block.querySelector("pre");
        if (!pre) return;
        const ok = await copyToClipboard(pre.textContent);
        if (ok) {
          btn.classList.add("copied");
          btn.innerHTML = '<i class="fas fa-check"></i>';
          setTimeout(function () {
            btn.classList.remove("copied");
            btn.innerHTML = '<i class="fas fa-copy"></i>';
          }, 1800);
        }
      });
      block.appendChild(btn);
    });

    root.querySelectorAll(".blog-post pre").forEach(function (pre) {
      if (pre.closest(".code")) return;
      if (pre.parentElement && pre.parentElement.classList.contains("code-wrap")) return;

      const wrapper = document.createElement("div");
      wrapper.className = "code-wrap";
      wrapper.style.position = "relative";
      wrapper.style.margin = "18px 0";
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      const btn = document.createElement("button");
      btn.className = "code-copy";
      btn.style.opacity = "0.7";
      btn.setAttribute("aria-label", "Copy code");
      btn.innerHTML = '<i class="fas fa-copy"></i>';
      btn.addEventListener("click", async function (e) {
        e.stopPropagation();
        const ok = await copyToClipboard(pre.textContent);
        if (ok) {
          btn.classList.add("copied");
          btn.innerHTML = '<i class="fas fa-check"></i>';
          setTimeout(function () {
            btn.classList.remove("copied");
            btn.innerHTML = '<i class="fas fa-copy"></i>';
          }, 1800);
        }
      });
      wrapper.appendChild(btn);
    });
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (err) {
      showToast("Couldn't copy to clipboard", "error");
      return false;
    }
  }

  /* ============================================================
     BLOG / NOTES
     ============================================================ */
  function initBlog(root) {
    const list = root.querySelector("[data-blog-index]");
    if (list) loadBlogIndex(list, root);
  }

  async function loadBlogIndex(container, root) {
    const jsonUrl = container.getAttribute("data-blog-index");
    const filtersHost = root.querySelector("[data-blog-filters]");
    container.innerHTML = '<p style="color:var(--muted);font-size:.85rem;">Loading…</p>';

    try {
      const res = await fetch(jsonUrl, { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const posts = await res.json();
      if (!Array.isArray(posts) || !posts.length) {
        container.innerHTML = '<p style="color:var(--muted);font-size:.85rem;">No notes yet.</p>';
        return;
      }
      const categories = ["All"];
      posts.forEach(function (p) {
        const c = p.category || "Other";
        if (!categories.includes(c)) categories.push(c);
      });
      let activeCategory = "All";

      function renderFilters() {
        if (!filtersHost) return;
        filtersHost.innerHTML = categories.map(function (c) {
          const count = c === "All" ? posts.length
            : posts.filter(function (p) { return (p.category || "Other") === c; }).length;
          return '<button class="blog-filter' + (c === activeCategory ? " active" : "") + '" ' +
                 'data-cat="' + escapeHtml(c) + '">' + escapeHtml(c) +
                 '<span class="count">' + count + '</span></button>';
        }).join("");
        filtersHost.querySelectorAll(".blog-filter").forEach(function (btn) {
          btn.addEventListener("click", function () {
            activeCategory = btn.getAttribute("data-cat");
            renderFilters(); renderPosts();
          });
        });
      }

      function renderPosts() {
        const filtered = activeCategory === "All" ? posts
          : posts.filter(function (p) { return (p.category || "Other") === activeCategory; });
        if (!filtered.length) {
          container.innerHTML = '<p style="color:var(--muted);font-size:.85rem;">No notes in this category.</p>';
          return;
        }
        container.innerHTML = filtered.map(renderBlogCard).join("");
        container.querySelectorAll("[data-blog-open]").forEach(function (link) {
          link.addEventListener("click", function (e) {
            e.preventDefault();
            openBlogPost(link.getAttribute("data-blog-open"), container);
          });
        });
      }

      renderFilters(); renderPosts();
    } catch (err) {
      container.innerHTML = '<p style="color:var(--muted);font-size:.85rem;">Could not load notes: ' + err.message + '</p>';
    }
  }

  function renderBlogCard(post) {
    const tags = (post.tags || []).slice(0, 3).map(function (t) {
      return '<span>' + escapeHtml(t) + '</span>';
    }).join("");
    const cat = post.category
      ? '<span class="blog-card-cat">' + escapeHtml(post.category) + '</span>'
      : "";
    return (
      '<a href="#" class="blog-card" data-blog-open="' + escapeHtml(post.slug) + '">' +
        '<div class="blog-card-meta">' + cat +
          '<span>' + escapeHtml(post.date || "") + '</span>' +
          (tags ? '<span class="blog-card-tags">' + tags + '</span>' : '') +
        '</div>' +
        '<h3 class="blog-card-title">' + escapeHtml(post.title || "") + '</h3>' +
        '<p class="blog-card-excerpt">' + escapeHtml(post.excerpt || "") + '</p>' +
        '<span class="blog-card-read">Read →</span>' +
      '</a>'
    );
  }

  async function openBlogPost(slug, fromContainer) {
    const body = fromContainer.closest(".window-body") || fromContainer;
    if (!body) return;
    const url = "apps/blog/posts/" + slug + ".md";
    body.innerHTML = '<p style="color:var(--muted);font-size:.85rem;">Loading…</p>';
    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const md = await res.text();
      body.innerHTML = renderMarkdown(md);
      body.scrollTop = 0;
      const back = document.createElement("a");
      back.className = "blog-back";
      back.href = "#";
      back.innerHTML = '<i class="fas fa-arrow-left"></i> All notes';
      back.addEventListener("click", function (e) {
        e.preventDefault();
        loadIntoWindow(body, "apps/blog/index.html");
      });
      body.insertBefore(back, body.firstChild);
      highlightAllCode(body);
      injectCopyButtons(body);
    } catch (err) {
      body.innerHTML = '<p style="color:var(--muted);font-size:.85rem;">Could not load note: ' + err.message + '</p>';
    }
  }

  function renderMarkdown(md) {
    if (window.marked && typeof window.marked.parse === "function") {
      try {
        if (typeof window.marked.setOptions === "function") {
          window.marked.setOptions({ gfm: true, breaks: false });
        }
        const raw = window.marked.parse(md);
        const clean = window.DOMPurify
          ? window.DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } }) : raw;
        return '<article class="blog-post">' + clean + '</article>';
      } catch (err) {}
    }
    const escaped = md.replace(/[<>&]/g, function (c) {
      return { "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c];
    });
    return '<article class="blog-post"><pre><code>' + escaped + '</code></pre></article>';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ============================================================
     TOASTS
     ============================================================ */
  function showToast(message, type) {
    type = type || "info";
    const container = document.getElementById("toast-container");
    if (!container) return;
    const icons = {
      info:    "fas fa-circle-info",
      success: "fas fa-circle-check",
      error:   "fas fa-circle-xmark",
      warn:    "fas fa-triangle-exclamation"
    };
    const el = document.createElement("div");
    el.className = "toast toast-" + type;
    el.innerHTML = '<i class="' + (icons[type] || icons.info) + '" aria-hidden="true"></i><div class="toast-text"></div>';
    el.querySelector(".toast-text").textContent = message;
    container.appendChild(el);
    setTimeout(function () {
      el.classList.add("toast-leave");
      setTimeout(function () { el.remove(); }, 260);
    }, 3000);
  }

  /* ============================================================
     SETTINGS APP
     ============================================================ */
  function initSettings(root) {
    const doc = root.querySelector(".settings-doc");
    if (!doc) return;
    const current = loadSettings();

    doc.querySelectorAll("[data-setting]").forEach(function (group) {
      const key = group.getAttribute("data-setting");
      const value = current[key];
      group.querySelectorAll("button").forEach(function (btn) {
        const isActive = btn.getAttribute("data-value") === value;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-checked", String(isActive));
      });
    });

    doc.querySelectorAll("[data-setting]").forEach(function (group) {
      const key = group.getAttribute("data-setting");
      group.querySelectorAll("button").forEach(function (btn) {
        btn.addEventListener("click", function () {
          const value = btn.getAttribute("data-value");
          applySetting(key, value);
          group.querySelectorAll("button").forEach(function (b) {
            const on = b === btn;
            b.classList.toggle("active", on);
            b.setAttribute("aria-checked", String(on));
          });
        });
      });
    });
  }

  /* ============================================================
     PYODIDE + EDITABLE CODE EDITOR
     ============================================================ */
  let pyodidePromise = null;

  function getPyodide() {
    if (!pyodidePromise) {
      pyodidePromise = new Promise(function (resolve, reject) {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js";
        script.onload = async function () {
          try {
            const py = await window.loadPyodide({
              indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/"
            });
            resolve(py);
          } catch (e) { reject(e); }
        };
        script.onerror = function () { reject(new Error("Failed to load Pyodide")); };
        document.head.appendChild(script);
      });
    }
    return pyodidePromise;
  }

  async function runPython(code, outputEl, runBtn) {
    outputEl.hidden = false;
    outputEl.classList.remove("is-error");
    outputEl.classList.add("is-loading");
    outputEl.querySelector(".learn-output-body").textContent =
      pyodidePromise ? "Running…" : "Loading Python (first time only, ~10MB)…";

    try {
      const py = await getPyodide();
      try { await py.loadPackagesFromImports(code); } catch (e) {}

      let buffer = "";
      py.setStdout({ batched: function (m) { buffer += m + "\n"; } });
      py.setStderr({ batched: function (m) { buffer += m + "\n"; } });

      outputEl.classList.remove("is-loading");
      outputEl.querySelector(".learn-output-body").textContent = "";

      try {
        await py.runPythonAsync(code);
        outputEl.querySelector(".learn-output-body").textContent = buffer || "(no output)";
        return { ok: true };
      } catch (err) {
        outputEl.classList.add("is-error");
        outputEl.querySelector(".learn-output-body").textContent =
          (buffer ? buffer + "\n" : "") + (err && err.message ? err.message : String(err));
        return { ok: false };
      }
    } catch (err) {
      outputEl.classList.add("is-error");
      outputEl.classList.remove("is-loading");
      outputEl.querySelector(".learn-output-body").textContent =
        "Couldn't load Python runner: " + (err.message || err);
      return { ok: false };
    }
  }

  /* Turn a .code[data-lang=python] block into an editable editor. */
  function makeEditable(block, initialCode, opts) {
    opts = opts || {};
    if (block.dataset.editorDone === "1") return;
    block.dataset.editorDone = "1";
    block.classList.add("code-editable");

    const storageKey = opts.storageKey || null;
    const saved = storageKey ? sessionStorage.getItem(storageKey) : null;
    const code = saved != null ? saved : initialCode;

    block.innerHTML = "";

    // Header
    const header = document.createElement("div");
    header.className = "code-header";
    header.innerHTML =
      '<span class="code-lang">python</span>' +
      '<div class="code-actions">' +
        '<button class="code-btn code-reset" title="Reset to original" aria-label="Reset">' +
          '<i class="fas fa-rotate-left"></i>' +
        '</button>' +
        '<button class="code-btn code-copy" title="Copy code" aria-label="Copy">' +
          '<i class="fas fa-copy"></i>' +
        '</button>' +
        '<button class="code-btn code-run" title="Run code">' +
          '<i class="fas fa-play"></i> <span class="btn-label">Run</span>' +
        '</button>' +
      '</div>';
    block.appendChild(header);

    // Body — overlay stack
    const bodyEl = document.createElement("div");
    bodyEl.className = "code-body";
    bodyEl.innerHTML =
      '<div class="code-input-wrap">' +
        '<pre class="code-highlight" aria-hidden="true"><code class="language-python"></code></pre>' +
        '<textarea class="code-input" spellcheck="false" autocapitalize="off" ' +
                  'autocomplete="off" aria-label="Editable Python code"></textarea>' +
      '</div>';
    block.appendChild(bodyEl);

    const textarea = bodyEl.querySelector(".code-input");
    const codeEl   = bodyEl.querySelector(".code-highlight code");

    // Output panel
    const output = document.createElement("div");
    output.className = "learn-output";
    output.hidden = true;
    output.innerHTML =
      '<div class="learn-output-header"><i class="fas fa-terminal"></i> output</div>' +
      '<div class="learn-output-body"></div>';
    block.appendChild(output);

    const runBtn   = header.querySelector(".code-run");
    const copyBtn  = header.querySelector(".code-copy");
    const resetBtn = header.querySelector(".code-reset");

    // Highlight routine — uses the low-level API so re-highlighting
    // works after every keystroke (highlightElement caches).
    function highlight() {
      const text = textarea.value;
      if (window.hljs) {
        try {
          const result = window.hljs.highlight(text, {
            language: "python",
            ignoreIllegals: true
          });
          codeEl.innerHTML = result.value;
          return;
        } catch (e) { /* fall through to plain text */ }
      }
      codeEl.textContent = text;
    }

    // Auto-resize routine
    function autosize() {
      textarea.style.height = "0px";
      textarea.style.height = textarea.scrollHeight + "px";
    }

    // Save state
    function save() {
      if (!storageKey) return;
      try { sessionStorage.setItem(storageKey, textarea.value); } catch (e) {}
    }

    // Init
    textarea.value = code;
    highlight();
    autosize();

    // Input — rehighlight + resize + save
    textarea.addEventListener("input", function () {
      highlight();
      autosize();
      save();
      block.classList.remove("has-success", "has-error");
    });

    // Tab inserts 4 spaces
    textarea.addEventListener("keydown", function (e) {
      if (e.key === "Tab") {
        e.preventDefault();
        const s = textarea.selectionStart;
        const t = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, s) + "    " + textarea.value.substring(t);
        textarea.selectionStart = textarea.selectionEnd = s + 4;
        textarea.dispatchEvent(new Event("input"));
        return;
      }
      // Auto-indent on Enter (after ":" add 4 spaces)
      if (e.key === "Enter") {
        const s = textarea.selectionStart;
        const before = textarea.value.substring(0, s);
        const lineStart = before.lastIndexOf("\n") + 1;
        const currentLine = before.substring(lineStart);
        const indentMatch = currentLine.match(/^\s*/);
        const indent = indentMatch ? indentMatch[0] : "";
        const extra = currentLine.trimEnd().endsWith(":") ? "    " : "";
        if (indent || extra) {
          e.preventDefault();
          const insertion = "\n" + indent + extra;
          textarea.value = before + insertion + textarea.value.substring(s);
          textarea.selectionStart = textarea.selectionEnd = s + insertion.length;
          textarea.dispatchEvent(new Event("input"));
        }
      }
    });

    // Run
    runBtn.addEventListener("click", async function (e) {
      e.stopPropagation();
      runBtn.disabled = true;
      runBtn.classList.add("loading");
      runBtn.classList.remove("success", "error");
      runBtn.innerHTML = '<i class="fas fa-circle-notch"></i> <span class="btn-label">Loading</span>';

      block.classList.remove("has-success", "has-error");

      const result = await runPython(textarea.value, output, runBtn);

      runBtn.classList.remove("loading");
      if (result.ok) {
        runBtn.classList.add("success");
        runBtn.innerHTML = '<i class="fas fa-check"></i> <span class="btn-label">Run</span>';
        block.classList.add("has-success");
        setTimeout(function () {
          runBtn.classList.remove("success");
          runBtn.innerHTML = '<i class="fas fa-play"></i> <span class="btn-label">Run</span>';
          block.classList.remove("has-success");
        }, 1800);
      } else {
        runBtn.classList.add("error");
        runBtn.innerHTML = '<i class="fas fa-xmark"></i> <span class="btn-label">Error</span>';
        block.classList.add("has-error");
        setTimeout(function () {
          runBtn.classList.remove("error");
          runBtn.innerHTML = '<i class="fas fa-play"></i> <span class="btn-label">Run</span>';
        }, 2400);
      }
      runBtn.disabled = false;
    });

    // Copy — copies current textarea value
    copyBtn.addEventListener("click", async function (e) {
      e.stopPropagation();
      const ok = await copyToClipboard(textarea.value);
      if (ok) {
        copyBtn.classList.add("copied");
        copyBtn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(function () {
          copyBtn.classList.remove("copied");
          copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        }, 1800);
      }
    });

    // Reset — restores original, updates highlight + size
    resetBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      textarea.value = initialCode;
      highlight();
      autosize();
      save();
      block.classList.remove("has-success", "has-error");
      output.hidden = true;
    });
  }

  /* Inject a Playground at the bottom of every Python course page. */
  function injectPlayground(root, url) {
    const doc = root.querySelector(".python-doc");
    if (!doc) return;
    if (doc.querySelector(".playground")) return;

    const playground = document.createElement("div");
    playground.className = "playground";
    playground.innerHTML =
      '<div class="playground-header">' +
        '<h2 class="playground-title"><i class="fas fa-flask"></i> Playground</h2>' +
        '<p class="playground-sub">Type any Python. Press Run to see what happens. Your code stays here while you explore the course.</p>' +
      '</div>' +
      '<div class="code" data-lang="python"></div>';
    doc.appendChild(playground);

    const block = playground.querySelector(".code");
    const initial = [
      "# SRXL Playground — try anything.",
      "# Your code is saved as you type.",
      "",
      "print(\"Hello, meadow!\")",
      "",
      "for i in range(3):",
      "    print(i, \"— a small step\")",
      ""
    ].join("\n");

    makeEditable(block, initial, { storageKey: "srxl-playground" });
  }

  function initPyodide(root, url) {
    const hasPyCourse = root.querySelector(".python-doc");
    if (!hasPyCourse) return;

    // Turn each Python code block into an editor
    root.querySelectorAll('.code[data-lang="python"]:not([data-editor-done])').forEach(function (block, index) {
      // Skip if it's the playground block (handled separately)
      if (block.closest(".playground")) return;
      const pre = block.querySelector("pre");
      if (!pre) return;
      const initial = pre.textContent;
      const storageKey = url ? "srxl-code:" + url + ":" + index : null;
      makeEditable(block, initial, { storageKey: storageKey });
    });

    // Then add the playground at the bottom of the doc
    injectPlayground(root, url);
  }

  /* ============================================================
     WINDOW HELPERS
     ============================================================ */
  function closeApp(id) {
    const win = openApps.get(id);
    if (!win) return;
    const trigger = win._trigger;
    win.classList.add("closing");
    setTimeout(function () {
      win.remove();
      openApps.delete(id);
      const task = document.querySelector('[data-task="' + id + '"]');
      if (task) task.remove();

      const remaining = Array.from(openApps.keys());
      if (remaining.length) {
        const topId = remaining.reduce(function (a, b) {
          const az = parseInt(openApps.get(a).style.zIndex, 10) || 0;
          const bz = parseInt(openApps.get(b).style.zIndex, 10) || 0;
          return az >= bz ? a : b;
        });
        focusApp(topId);
        if (location.hash.startsWith("#app/")) {
          history.replaceState(null, "", "#app/" + topId);
        }
      } else {
        activeAppId = null;
        setActiveTask(null);
        if (location.hash.startsWith("#app/")) {
          history.replaceState(null, "", location.pathname + location.search);
        }
        if (trigger && typeof trigger.focus === "function") trigger.focus();
      }
    }, 250);
  }

  function focusApp(id) {
    const win = openApps.get(id);
    if (!win) return;
    win.style.zIndex = ++zIndex;
    activeAppId = id;
    setActiveTask(id);
  }

  function setActiveTask(id) {
    document.querySelectorAll(".task-app").forEach(function (t) {
      const isActive = t.dataset.task === id;
      t.classList.toggle("active", isActive);
      t.setAttribute("aria-pressed", String(isActive));
    });
  }

  function addTaskItem(id, meta) {
    const item = document.createElement("button");
    item.className = "task-app";
    item.dataset.task = id;
    item.setAttribute("aria-label", meta.title);
    item.setAttribute("aria-pressed", "false");
    item.innerHTML = '<i class="' + meta.icon + '"></i>';
    item.addEventListener("click", function () {
      const win = openApps.get(id);
      if (!win) return;
      if (win.classList.contains("minimized")) {
        win.classList.remove("minimized");
        focusApp(id);
      } else if (activeAppId === id) {
        win.classList.add("minimized");
        activeAppId = null;
        setActiveTask(null);
      } else {
        focusApp(id);
      }
    });
    taskbar.appendChild(item);
  }

  /* ============================================================
     WINDOW DRAGGING + SNAPPING
     ============================================================ */
  function makeDraggable(win, handle) {
    let startX = 0, startY = 0, originX = 0, originY = 0, dragging = false;
    let currentSnap = null;
    const snapPreview = document.getElementById("snap-preview");

    function detectSnap(e) {
      if (window.matchMedia("(max-width: 760px)").matches) return null;
      const edge = 24;
      const x = e.clientX, y = e.clientY;
      const W = window.innerWidth;
      if (y < edge) return "max";
      if (x < edge) return "left";
      if (x > W - edge) return "right";
      return null;
    }

    function showSnapPreview(type) {
      if (!snapPreview) return;
      if (!type) { snapPreview.classList.remove("show"); return; }
      const isLinux = document.body.classList.contains("linux-mode");
      const topOffset = isLinux ? 38 : 52;
      const W = window.innerWidth, H = window.innerHeight;
      let r;
      if (type === "max") {
        r = { left: 8, top: topOffset + 8, width: W - 16, height: H - topOffset - 16 };
      } else if (type === "left") {
        r = { left: 8, top: topOffset + 8, width: (W - 24) / 2, height: H - topOffset - 16 };
      } else {
        r = { left: W / 2 + 4, top: topOffset + 8, width: (W - 24) / 2, height: H - topOffset - 16 };
      }
      snapPreview.style.left = r.left + "px";
      snapPreview.style.top = r.top + "px";
      snapPreview.style.width = r.width + "px";
      snapPreview.style.height = r.height + "px";
      snapPreview.classList.add("show");
    }

    handle.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".ctrl")) return;
      if (window.matchMedia("(max-width: 760px)").matches) return;

      if (win.classList.contains("maximized") ||
          win.classList.contains("snap-left") ||
          win.classList.contains("snap-right")) {
        const rect = win.getBoundingClientRect();
        const defaultW = 680, defaultH = 480;
        const ratioX = (e.clientX - rect.left) / Math.max(rect.width, 1);
        win.classList.remove("maximized", "snap-left", "snap-right");
        win.style.width = defaultW + "px";
        win.style.height = defaultH + "px";
        win.style.left = Math.max(0, e.clientX - defaultW * ratioX) + "px";
        win.style.top = Math.max(0, e.clientY - 20) + "px";
        const icon = win.querySelector(".max i");
        if (icon) icon.className = "fas fa-expand";
      }

      dragging = true;
      startX = e.clientX; startY = e.clientY;
      originX = win.offsetLeft; originY = win.offsetTop;
      handle.setPointerCapture(e.pointerId);
      document.body.style.userSelect = "none";
    });

    handle.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      const maxX = window.innerWidth - 120, maxY = window.innerHeight - 80;
      win.style.left = Math.min(Math.max(-40, originX + e.clientX - startX), maxX) + "px";
      win.style.top  = Math.min(Math.max(0,   originY + e.clientY - startY), maxY) + "px";
      const snap = detectSnap(e);
      if (snap !== currentSnap) {
        currentSnap = snap;
        showSnapPreview(snap);
      }
    });

    function stop(e) {
      if (!dragging) return;
      dragging = false;
      document.body.style.userSelect = "";
      try { handle.releasePointerCapture(e.pointerId); } catch (err) {}
      if (currentSnap) {
        applySnap(win, currentSnap);
        currentSnap = null;
      }
      if (snapPreview) snapPreview.classList.remove("show");
    }

    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }

  function applySnap(win, type) {
    win.classList.remove("snap-left", "snap-right", "maximized");
    if (type === "max") win.classList.add("maximized");
    else if (type === "left") win.classList.add("snap-left");
    else if (type === "right") win.classList.add("snap-right");
    const icon = win.querySelector(".max i");
    if (icon) {
      icon.className = win.classList.contains("maximized") ? "fas fa-compress" : "fas fa-expand";
    }
  }

  /* ============================================================
     INTERACTIVE TERMINAL
     ============================================================ */
  function runTerminal(host, mode) {
    const isLinux = mode === "linux";
    const prompt = isLinux ? "sina@srxl:~$" : "PS C:\\Users\\Sina>";

    const banner = document.createElement("div");
    banner.className = "term-banner";
    banner.textContent = isLinux
      ? "SRXL Linux v1.0 — type 'help' for available commands"
      : "SRXL PowerShell — type 'help' for available commands";
    host.appendChild(banner);

    const commands = {
      help: function () {
        return isLinux
          ? "Available: whoami, date, uname, echo <text>, clear, help"
          : "Available: whoami, date, echo <text>, cls, help";
      },
      whoami: function () { return isLinux ? "sina" : "desktop-7f2a\\sina"; },
      date:   function () { return new Date().toLocaleString(); },
      uname:  function () { return "SRXL Linux v1.0 (x86_64, built with care)"; },
      echo:   function (args) { return args.join(" "); }
    };

    const inputLine = document.createElement("div");
    inputLine.className = "terminal-line";
    const promptSpan = document.createElement("span");
    promptSpan.className = "prompt";
    promptSpan.textContent = prompt;
    const input = document.createElement("input");
    input.className = "terminal-input";
    input.type = "text";
    input.setAttribute("aria-label", "Terminal input");
    input.spellcheck = false;
    input.autocomplete = "off";
    input.autocapitalize = "off";
    inputLine.appendChild(promptSpan);
    inputLine.appendChild(document.createTextNode(" "));
    inputLine.appendChild(input);
    host.appendChild(inputLine);
    host.setAttribute("role", "log");
    host.setAttribute("aria-live", "polite");

    function scrollBottom() { host.scrollTop = host.scrollHeight; }

    function printCommand(cmdText) {
      const line = document.createElement("div");
      line.className = "term-cmd";
      const p = document.createElement("span");
      p.className = "prompt";
      p.textContent = prompt;
      line.appendChild(p);
      line.appendChild(document.createTextNode(" " + cmdText));
      host.insertBefore(line, inputLine);
    }
    function printOutput(text) {
      const line = document.createElement("div");
      line.className = "term-out";
      line.textContent = text;
      host.insertBefore(line, inputLine);
    }

    input.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      const raw = input.value;
      input.value = "";
      printCommand(raw);
      const trimmed = raw.trim();
      if (!trimmed) { scrollBottom(); return; }
      const parts = trimmed.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);
      if (cmd === "clear" || cmd === "cls") {
        host.querySelectorAll(".term-cmd, .term-out, .term-banner").forEach(function (n) { n.remove(); });
        scrollBottom();
        return;
      }
      const fn = commands[cmd];
      printOutput(fn ? String(fn(args)) : cmd + ": command not found. Type 'help'.");
      scrollBottom();
    });

    setTimeout(function () { input.focus(); }, 120);
  }

  /* ============================================================
     CLOCK
     ============================================================ */
  function startClock() {
    const el = document.getElementById("clock");
    function tick() {
      el.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    tick();
    setInterval(tick, 15000);
  }

  /* ============================================================
     LIGHTBOX
     ============================================================ */
  const lightbox  = document.getElementById("lightbox");
  const lbImage   = document.getElementById("lb-image");
  const lbCaption = document.getElementById("lb-caption");
  const lbCounter = document.getElementById("lb-counter");
  const lbPrev    = lightbox.querySelector(".lb-prev");
  const lbNext    = lightbox.querySelector(".lb-next");
  const lbClose   = lightbox.querySelector(".lb-close");
  let lbList = [], lbIndex = 0, lastFocused = null;

  function openLightbox(list, index, origin) {
    if (!list.length) return;
    lbList = list;
    lbIndex = Math.max(0, Math.min(index, list.length - 1));
    lastFocused = origin || document.activeElement;
    renderLb();
    lightbox.hidden = false;
    void lightbox.offsetWidth;
    lightbox.classList.add("show");
    document.body.style.overflow = "hidden";
    lbClose.focus();
  }
  function closeLightbox() {
    lightbox.classList.remove("show");
    lightbox.classList.add("closing");
    setTimeout(function () {
      lightbox.classList.remove("closing");
      lightbox.hidden = true;
      document.body.style.overflow = "";
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }, 320);
  }
  function renderLb() {
    const item = lbList[lbIndex];
    if (!item) return;
    lbImage.src = item.src;
    lbImage.alt = item.caption || "";
    lbCaption.textContent = item.caption || "";
    lbCounter.textContent = (lbIndex + 1) + " / " + lbList.length;
    const many = lbList.length > 1;
    lbPrev.style.display = many ? "" : "none";
    lbNext.style.display = many ? "" : "none";
  }
  function nextLb() {
    if (!lbList.length) return;
    lbIndex = (lbIndex + 1) % lbList.length;
    animateSwap(); renderLb();
  }
  function prevLb() {
    if (!lbList.length) return;
    lbIndex = (lbIndex - 1 + lbList.length) % lbList.length;
    animateSwap(); renderLb();
  }
  function animateSwap() {
    lbImage.style.transition = "opacity .18s";
    lbImage.style.opacity = "0";
    setTimeout(function () { lbImage.style.opacity = "1"; }, 100);
  }

  document.addEventListener("click", function (e) {
    const shot = e.target.closest(".shot[data-full]");
    if (!shot) return;
    e.preventDefault();
    const gallery = shot.closest(".gallery");
    const siblings = gallery ? Array.from(gallery.querySelectorAll(".shot[data-full]")) : [shot];
    openLightbox(
      siblings.map(function (el) {
        return { src: el.dataset.full, caption: el.dataset.caption || "" };
      }),
      siblings.indexOf(shot), shot
    );
  });

  lightbox.addEventListener("click", function (e) { if (e.target === lightbox) closeLightbox(); });
  lbClose.addEventListener("click", closeLightbox);
  lbNext.addEventListener("click", function (e) { e.stopPropagation(); nextLb(); });
  lbPrev.addEventListener("click", function (e) { e.stopPropagation(); prevLb(); });

  document.addEventListener("keydown", function (e) {
    if (lightbox.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); closeLightbox(); }
    if (e.key === "ArrowRight") { e.preventDefault(); nextLb(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); prevLb(); }
  });

  lightbox.addEventListener("keydown", function (e) {
    if (e.key !== "Tab") return;
    const focusables = lightbox.querySelectorAll(
      'button, [href], input, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    const shot = document.activeElement && document.activeElement.closest
      ? document.activeElement.closest(".shot[data-full]") : null;
    if (!shot) return;
    e.preventDefault();
    shot.click();
  });

  document.addEventListener("keydown", function (e) {
    if (!lightbox.hidden) return;
    if (!activeAppId) return;
    const isEscape = e.key === "Escape";
    const isCtrlW  = e.ctrlKey && (e.key === "w" || e.key === "W");
    if (isEscape || isCtrlW) {
      // Don't close the window if focus is inside any editable element
      const el = document.activeElement;
      const inEditable = el && (
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable
      );
      if (inEditable) return;
      e.preventDefault();
      closeApp(activeAppId);
    }
  });

  /* ============================================================
     DESKTOP ICONS + START MENU
     ============================================================ */
  document.querySelectorAll("[data-open]").forEach(function (btn) {
    btn.addEventListener("click", function () { openApp(btn.dataset.open, btn); });
    btn.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openApp(btn.dataset.open, btn);
      }
    });
  });

  let startMenuEl = null;
  const startBtn = document.querySelector(".start-btn");
  const activitiesEl = document.querySelector(".activities");

  function toggleStartMenu(e) {
    if (e) e.stopPropagation();
    if (startMenuEl) { closeStartMenu(); return; }
    startMenuEl = document.createElement("div");
    startMenuEl.className = "start-menu";
    startMenuEl.setAttribute("role", "menu");
    startMenuEl.setAttribute("aria-label", "Applications");
    const header = document.createElement("div");
    header.className = "start-menu-header";
    header.textContent = "SRXL OS";
    startMenuEl.appendChild(header);

    Object.keys(APPS).forEach(function (id) {
      const meta = APPS[id];
      const btn = document.createElement("button");
      btn.className = "start-menu-item";
      btn.setAttribute("role", "menuitem");
      btn.innerHTML = '<i class="' + meta.icon + '"></i><span>' + meta.title + '</span>';
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        openApp(id, btn);
        closeStartMenu();
      });
      startMenuEl.appendChild(btn);
    });

    const divider = document.createElement("div");
    divider.className = "start-menu-divider";
    startMenuEl.appendChild(divider);

    const switchBtn = document.createElement("button");
    switchBtn.className = "start-menu-item start-menu-switch";
    switchBtn.setAttribute("role", "menuitem");
    switchBtn.innerHTML = '<i class="fas fa-rotate"></i><span>Switch OS</span>';
    switchBtn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      location.reload();
    });
    startMenuEl.appendChild(switchBtn);

    document.getElementById("taskbar").appendChild(startMenuEl);
    setTimeout(function () {
      document.addEventListener("click", outsideStartMenu);
      document.addEventListener("keydown", escapeStartMenu);
    }, 0);
  }
  function closeStartMenu() {
    if (!startMenuEl) return;
    startMenuEl.remove();
    startMenuEl = null;
    document.removeEventListener("click", outsideStartMenu);
    document.removeEventListener("keydown", escapeStartMenu);
  }
  function outsideStartMenu(e) {
    if (!startMenuEl) return;
    if (startMenuEl.contains(e.target)) return;
    if (e.target.closest && e.target.closest(".start-btn")) return;
    if (e.target.closest && e.target.closest(".activities")) return;
    closeStartMenu();
  }
  function escapeStartMenu(e) { if (e.key === "Escape") closeStartMenu(); }

  if (startBtn) startBtn.addEventListener("click", toggleStartMenu);
  if (activitiesEl) {
    activitiesEl.style.cursor = "pointer";
    activitiesEl.addEventListener("click", toggleStartMenu);
  }

  /* ============================================================
     HASH ROUTING + DEFAULT OPEN
     ============================================================ */
  function restoreFromHash() {
    const match = location.hash.match(/^#app\/([a-z]+)$/i);
    if (match && APPS[match[1]]) {
      openApp(match[1]);
      return true;
    }
    return false;
  }
  window.addEventListener("hashchange", function () {
    const match = location.hash.match(/^#app\/([a-z]+)$/i);
    if (match && APPS[match[1]] && !openApps.has(match[1])) openApp(match[1]);
  });
  const observer = new MutationObserver(function () {
    if (desk.classList.contains("show")) {
      observer.disconnect();
      setTimeout(function () {
        if (!restoreFromHash()) openApp("about");
      }, 750);
    }
  });
  observer.observe(desk, { attributes: true, attributeFilter: ["class"] });

  /* ============================================================
     COMMAND PALETTE
     ============================================================ */
  const PALETTE_EXTRA = [
    { id: "py-01", title: "01 · Getting started", sub: "Python course", icon: "fab fa-python", url: "apps/python/01-getting-started.html" },
    { id: "py-02", title: "02 · Types & strings", sub: "Python course", icon: "fab fa-python", url: "apps/python/02-types.html" },
    { id: "py-03", title: "03 · Collections",     sub: "Python course", icon: "fab fa-python", url: "apps/python/03-collections.html" },
    { id: "py-04", title: "04 · Control flow",    sub: "Python course", icon: "fab fa-python", url: "apps/python/04-flow.html" },
    { id: "py-05", title: "05 · enumerate / zip", sub: "Python course", icon: "fab fa-python", url: "apps/python/05-useful.html" },
    { id: "py-06", title: "06 · Functions",       sub: "Python course", icon: "fab fa-python", url: "apps/python/06-functions.html" },
    { id: "py-07", title: "07 · Input & files",   sub: "Python course", icon: "fab fa-python", url: "apps/python/07-input-files.html" },
    { id: "py-08", title: "08 · Packages",        sub: "Python course", icon: "fab fa-python", url: "apps/python/08-packages.html" },
    { id: "py-09", title: "09 · Errors",          sub: "Python course", icon: "fab fa-python", url: "apps/python/09-errors.html" },
    { id: "py-10", title: "10 · Small project",   sub: "Python course", icon: "fab fa-python", url: "apps/python/10-project.html" }
  ];

  (function initPalette() {
    const palette  = document.getElementById("cmd-palette");
    if (!palette) return;
    const input    = document.getElementById("cmd-input");
    const results  = document.getElementById("cmd-results");
    const backdrop = palette.querySelector(".cmd-backdrop");

    let allItems = [], currentItems = [], active = 0, blogPosts = null;

    async function loadBlog() {
      if (blogPosts !== null) return blogPosts;
      try {
        const res = await fetch("apps/blog/posts.json");
        blogPosts = res.ok ? await res.json() : [];
      } catch (e) { blogPosts = []; }
      return blogPosts;
    }

    async function buildIndex() {
      const arr = [];
      Object.keys(APPS).forEach(function (id) {
        arr.push({
          icon: APPS[id].icon, title: APPS[id].title, sub: "Application",
          action: function () { openApp(id); }
        });
      });
      PALETTE_EXTRA.forEach(function (p) {
        arr.push({
          icon: p.icon, title: p.title, sub: p.sub,
          action: function () {
            openApp("python").then(function () {
              const w = openApps.get("python");
              if (!w) return;
              const body = w.querySelector(".window-body");
              if (body) loadIntoWindow(body, p.url);
            });
          }
        });
      });
      const posts = await loadBlog();
      posts.forEach(function (post) {
        arr.push({
          icon: "fas fa-feather",
          title: post.title,
          sub: "Note · " + (post.category || "Other"),
          action: function () {
            openApp("blog").then(function () {
              const w = openApps.get("blog");
              if (!w) return;
              const body = w.querySelector(".window-body");
              if (body) openBlogPost(post.slug, body);
            });
          }
        });
      });
      return arr;
    }

    function fuzzyScore(q, str) {
      if (!q) return 1;
      q = q.toLowerCase();
      str = String(str || "").toLowerCase();
      let qi = 0, score = 0;
      for (let i = 0; i < str.length && qi < q.length; i++) {
        if (str[i] === q[qi]) { score += i < 4 ? 3 : 1; qi++; }
      }
      return qi === q.length ? score : 0;
    }

    function render(query) {
      const q = query.trim();
      const scored = allItems.map(function (item) {
        const s = Math.max(fuzzyScore(q, item.title), fuzzyScore(q, item.sub));
        return { item: item, score: q ? s : 1 };
      });
      currentItems = scored
        .filter(function (x) { return x.score > 0; })
        .sort(function (a, b) { return b.score - a.score; })
        .map(function (x) { return x.item; });
      active = 0;
      if (!currentItems.length) {
        results.innerHTML = '<div class="cmd-empty">No matches for “' + escapeHtml(q) + '”</div>';
        return;
      }
      results.innerHTML = currentItems.map(function (item, i) {
        return '<div class="cmd-item' + (i === active ? " active" : "") + '" data-idx="' + i + '" role="option">' +
          '<i class="' + item.icon + '"></i>' +
          '<div class="cmd-item-text">' +
            '<div class="cmd-item-title">' + escapeHtml(item.title) + '</div>' +
            '<div class="cmd-item-sub">'   + escapeHtml(item.sub)   + '</div>' +
          '</div>' +
          (i < 9 ? '<kbd class="cmd-item-kbd">↵</kbd>' : '') +
        '</div>';
      }).join("");
      results.querySelectorAll(".cmd-item").forEach(function (el) {
        el.addEventListener("click", function () {
          runItem(parseInt(el.dataset.idx, 10));
        });
        el.addEventListener("mouseenter", function () {
          active = parseInt(el.dataset.idx, 10);
          results.querySelectorAll(".cmd-item").forEach(function (n, i) {
            n.classList.toggle("active", i === active);
          });
        });
      });
    }

    function runItem(idx) {
      const item = currentItems[idx];
      if (!item) return;
      closePalette();
      item.action();
    }
    function openPalette() {
      palette.hidden = false;
      palette.classList.add("show");
      input.value = "";
      results.innerHTML = '<div class="cmd-empty">Loading…</div>';
      buildIndex().then(function (arr) {
        allItems = arr;
        render("");
        setTimeout(function () { input.focus(); }, 30);
      });
      document.addEventListener("keydown", paletteKeydown);
    }
    function closePalette() {
      palette.classList.remove("show");
      palette.hidden = true;
      document.removeEventListener("keydown", paletteKeydown);
    }
    function paletteKeydown(e) {
      if (e.key === "Escape") { e.preventDefault(); closePalette(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, currentItems.length - 1); updateActive(); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); active = Math.max(active - 1, 0); updateActive(); return; }
      if (e.key === "Enter")     { e.preventDefault(); runItem(active); }
    }
    function updateActive() {
      const els = results.querySelectorAll(".cmd-item");
      els.forEach(function (n, i) { n.classList.toggle("active", i === active); });
      if (els[active]) els[active].scrollIntoView({ block: "nearest" });
    }

    input.addEventListener("input", function () { render(input.value); });
    backdrop.addEventListener("click", closePalette);

    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "k" || e.key === "/")) {
        e.preventDefault();
        if (palette.hidden) openPalette();
        else closePalette();
      }
    });
  })();

  /* ============================================================
     SERVICE WORKER + INSTALL PROMPT
     ============================================================ */
  if ("serviceWorker" in navigator &&
      location.hostname !== "localhost" &&
      location.hostname !== "127.0.0.1") {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
  }

  let deferredInstallPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    const showInstall = function () {
      if (document.querySelector(".install-prompt")) return;
      const bar = document.createElement("div");
      bar.className = "install-prompt";
      bar.innerHTML =
        '<i class="fas fa-download" style="color: var(--accent);"></i>' +
        '<div class="ip-text">' +
          '<div class="ip-title">Install SRXL OS</div>' +
          '<div class="ip-sub">Runs like a desktop app — works offline.</div>' +
        '</div>' +
        '<button class="ip-install">Install</button>' +
        '<button class="ip-dismiss" aria-label="Dismiss">×</button>';
      bar.querySelector(".ip-install").addEventListener("click", function () {
        bar.remove();
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.then(function () { deferredInstallPrompt = null; });
      });
      bar.querySelector(".ip-dismiss").addEventListener("click", function () { bar.remove(); });
      const toastHost = document.getElementById("toast-container");
      if (toastHost) toastHost.appendChild(bar);
    };
    if (desk.classList.contains("show")) showInstall();
    else {
      const w = new MutationObserver(function () {
        if (desk.classList.contains("show")) {
          w.disconnect();
          setTimeout(showInstall, 800);
        }
      });
      w.observe(desk, { attributes: true, attributeFilter: ["class"] });
    }
  });
  window.addEventListener("appinstalled", function () {
    deferredInstallPrompt = null;
    const bar = document.querySelector(".install-prompt");
    if (bar) bar.remove();
    showToast("SRXL OS installed", "success");
  });
})();