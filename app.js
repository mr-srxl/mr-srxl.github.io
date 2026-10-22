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
    terminal: { title: "Terminal", icon: "fas fa-terminal",    url: null, terminal: true }
  };

  const desk    = document.getElementById("desktop");
  const taskbar = document.getElementById("taskbar-items");
  const winHost = document.getElementById("windows-container");
  const openApps = new Map();
  let zIndex = 100, cascade = 0, activeAppId = null;

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
    try { sessionStorage.setItem("srxl-os", os); } catch (e) { /* storage may be blocked */ }

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
      line.innerHTML = last
        ? LINUX_LINES[i]
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

    // Update URL hash for deep linking
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
      e.stopPropagation(); win.classList.toggle("maximized");
      const icon = win.querySelector(".max i");
      icon.className = win.classList.contains("maximized") ? "fas fa-compress" : "fas fa-expand";
    });
    win.addEventListener("mousedown", function () { focusApp(id); });
    makeDraggable(win, win.querySelector("[data-drag]"));
    addTaskItem(id, { title: title, icon: meta.icon });
    focusApp(id);

    // Move keyboard focus into the window
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
      enhanceContent(body);
    } catch (err) {
      body.innerHTML =
        '<div class="load-error">' +
          '<h3>Couldn\'t load this section</h3>' +
          '<p>This site uses <code>fetch()</code> to load content, which requires a web server.</p>' +
          '<p class="small">Locally, run: <code>python -m http.server 8000</code><br>then open <code>http://localhost:8000</code></p>' +
          '<p class="small">Error: ' + err.message + '</p>' +
        '</div>';
    }
  }

  function enhanceContent(root) {
    wireInternalLinks(root);
    highlightAllCode(root);
    injectCopyButtons(root);
    initBlog(root);
  }

  function wireInternalLinks(root) {
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
     COPY BUTTONS
     ============================================================ */
  function injectCopyButtons(root) {
    root.querySelectorAll(".code").forEach(function (block) {
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
    } catch (err) { return false; }
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
          const count = c === "All"
            ? posts.length
            : posts.filter(function (p) { return (p.category || "Other") === c; }).length;
          return (
            '<button class="blog-filter' + (c === activeCategory ? " active" : "") + '" ' +
                    'data-cat="' + escapeHtml(c) + '">' +
              escapeHtml(c) +
              '<span class="count">' + count + '</span>' +
            '</button>'
          );
        }).join("");

        filtersHost.querySelectorAll(".blog-filter").forEach(function (btn) {
          btn.addEventListener("click", function () {
            activeCategory = btn.getAttribute("data-cat");
            renderFilters();
            renderPosts();
          });
        });
      }

      function renderPosts() {
        const filtered = activeCategory === "All"
          ? posts
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

      renderFilters();
      renderPosts();
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
        '<div class="blog-card-meta">' +
          cat +
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
    const body = fromContainer.closest(".window-body");
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

  /* Markdown render with DOMPurify sanitization (XSS-safe) */
  function renderMarkdown(md) {
    if (window.marked && typeof window.marked.parse === "function") {
      try {
        if (typeof window.marked.setOptions === "function") {
          window.marked.setOptions({ gfm: true, breaks: false });
        }
        const raw = window.marked.parse(md);
        const clean = window.DOMPurify
          ? window.DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } })
          : raw;
        return '<article class="blog-post">' + clean + '</article>';
      } catch (err) { /* fall through */ }
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
        // Pick the window with the highest z-index
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
     DRAGGING
     ============================================================ */
  function makeDraggable(win, handle) {
    let startX = 0, startY = 0, originX = 0, originY = 0, dragging = false;
    handle.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".ctrl")) return;
      if (win.classList.contains("maximized")) return;
      if (window.matchMedia("(max-width: 760px)").matches) return;
      dragging = true; startX = e.clientX; startY = e.clientY;
      originX = win.offsetLeft; originY = win.offsetTop;
      handle.setPointerCapture(e.pointerId);
      document.body.style.userSelect = "none";
    });
    handle.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      const maxX = window.innerWidth - 120, maxY = window.innerHeight - 80;
      win.style.left = Math.min(Math.max(-40, originX + e.clientX - startX), maxX) + "px";
      win.style.top  = Math.min(Math.max(0,   originY + e.clientY - startY), maxY) + "px";
    });
    function stop(e) {
      if (!dragging) return; dragging = false;
      document.body.style.userSelect = "";
      try { handle.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
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
      whoami: function () {
        return isLinux ? "sina" : "desktop-7f2a\\sina";
      },
      date: function () {
        return new Date().toLocaleString();
      },
      uname: function () {
        return "SRXL Linux v1.0 (x86_64, built with care)";
      },
      echo: function (args) {
        return args.join(" ");
      }
    };

    function buildInputLine() {
      const line = document.createElement("div");
      line.className = "terminal-line";
      const p = document.createElement("span");
      p.className = "prompt";
      p.textContent = prompt;
      const input = document.createElement("input");
      input.className = "terminal-input";
      input.type = "text";
      input.setAttribute("aria-label", "Terminal input");
      input.spellcheck = false;
      input.autocomplete = "off";
      input.autocapitalize = "off";
      line.appendChild(p);
      line.appendChild(document.createTextNode(" "));
      line.appendChild(input);
      return { line: line, input: input };
    }

    const io = buildInputLine();
    const inputLine = io.line;
    const input = io.input;
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
        host.querySelectorAll(".term-cmd, .term-out, .term-banner").forEach(function (n) {
          n.remove();
        });
        scrollBottom();
        return;
      }

      const fn = commands[cmd];
      const result = fn
        ? String(fn(args))
        : cmd + ": command not found. Type 'help'.";
      printOutput(result);
      scrollBottom();
    });

    // Focus after the window animation settles
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
    const siblings = gallery
      ? Array.from(gallery.querySelectorAll(".shot[data-full]"))
      : [shot];
    openLightbox(
      siblings.map(function (el) {
        return { src: el.dataset.full, caption: el.dataset.caption || "" };
      }),
      siblings.indexOf(shot),
      shot
    );
  });

  lightbox.addEventListener("click", function (e) {
    if (e.target === lightbox) closeLightbox();
  });
  lbClose.addEventListener("click", closeLightbox);
  lbNext.addEventListener("click", function (e) { e.stopPropagation(); nextLb(); });
  lbPrev.addEventListener("click", function (e) { e.stopPropagation(); prevLb(); });

  document.addEventListener("keydown", function (e) {
    if (lightbox.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); closeLightbox(); }
    if (e.key === "ArrowRight") { e.preventDefault(); nextLb(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); prevLb(); }
  });

  // Focus trap inside lightbox
  lightbox.addEventListener("keydown", function (e) {
    if (e.key !== "Tab") return;
    const focusables = lightbox.querySelectorAll(
      'button, [href], input, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });

  // Enter/Space opens focused gallery shots
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    const shot = document.activeElement && document.activeElement.closest
      ? document.activeElement.closest(".shot[data-full]")
      : null;
    if (!shot) return;
    e.preventDefault();
    shot.click();
  });

  // Escape / Ctrl+W closes the topmost window (when lightbox is not open)
  document.addEventListener("keydown", function (e) {
    if (!lightbox.hidden) return;
    if (!activeAppId) return;
    const isEscape = e.key === "Escape";
    const isCtrlW  = e.ctrlKey && (e.key === "w" || e.key === "W");
    if (isEscape || isCtrlW) {
      // Don't hijack Escape inside inputs inside the terminal
      const inTerminalInput = document.activeElement &&
        document.activeElement.classList &&
        document.activeElement.classList.contains("terminal-input");
      if (inTerminalInput && isEscape) return;
      e.preventDefault();
      closeApp(activeAppId);
    }
  });

  /* ============================================================
     DESKTOP ICONS + START MENU
     ============================================================ */
  document.querySelectorAll("[data-open]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      openApp(btn.dataset.open, btn);
    });
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
      try { sessionStorage.removeItem("srxl-os"); } catch (err) { /* ignore */ }
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

  function escapeStartMenu(e) {
    if (e.key === "Escape") closeStartMenu();
  }

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
    if (match && APPS[match[1]] && !openApps.has(match[1])) {
      openApp(match[1]);
    }
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
     SAVED-OS SKIP
     ============================================================ */
  let savedOS = null;
  try { savedOS = sessionStorage.getItem("srxl-os"); } catch (e) { /* ignore */ }
  if (savedOS === "windows" || savedOS === "linux") {
    bootScreen.style.display = "none";
    startLoading(savedOS);
  }
})();