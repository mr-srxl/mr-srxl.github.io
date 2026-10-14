(function () {
  "use strict";

  /* App registry */
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
  let zIndex = 100, cascade = 0;

  /* ---------- Boot ---------- */
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
      if (os === "windows") { winLoader.classList.add("show"); setTimeout(finish, 2600); }
      else { linuxLoader.classList.add("show"); renderLinuxBoot(function () { setTimeout(finish, 600); }); }
      function finish() {
        loadingScreen.classList.remove("show");
        setTimeout(function () {
          loadingScreen.classList.add("hide");
          if (os === "linux") document.body.classList.add("linux-mode");
          desk.classList.add("show");
          startClock();
        }, 440);
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
      line.innerHTML = last ? LINUX_LINES[i] : "[ <span class='ok'>  OK  </span> ] " + LINUX_LINES[i];
      linuxLoader.appendChild(line); i++;
      setTimeout(next, last ? 420 : 175);
    })();
  }

  /* ---------- Window management ---------- */
  async function openApp(id) {
    if (!APPS[id]) return;
    if (openApps.has(id)) {
      const existing = openApps.get(id);
      existing.classList.remove("minimized");
      focusApp(id); return;
    }
    const meta = APPS[id];
    const isLinux = document.body.classList.contains("linux-mode");
    let title = meta.title;
    if (meta.terminal) title = isLinux ? "Terminal" : "PowerShell";

    const win = document.createElement("div");
    win.className = "window";
    win.dataset.app = id;
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

    if (meta.terminal) runTerminal(body, isLinux ? "linux" : "windows");
    else await loadIntoWindow(body, meta.url);

    win.querySelector(".close").addEventListener("click", function (e) { e.stopPropagation(); closeApp(id); });
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
  }

  /* ---------- Load app content ---------- */
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

  /* ---------- Syntax highlighting ---------- */
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

  /* ---------- Copy button ---------- */
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

  /* ---------- Blog / Notes ---------- */
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

      // Build category list: "All" + unique categories
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

  function renderMarkdown(md) {
    if (window.marked && typeof window.marked.parse === "function") {
      try {
        if (typeof window.marked.setOptions === "function") {
          window.marked.setOptions({ gfm: true, breaks: false });
        }
        return '<article class="blog-post">' + window.marked.parse(md) + '</article>';
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

  /* ---------- Window helpers ---------- */
  function closeApp(id) {
    const win = openApps.get(id);
    if (!win) return;
    win.classList.add("closing");
    setTimeout(function () {
      win.remove(); openApps.delete(id);
      const task = document.querySelector('[data-task="' + id + '"]');
      if (task) task.remove();
      const remaining = Array.from(openApps.keys());
      if (remaining.length) focusApp(remaining[remaining.length - 1]);
    }, 220);
  }
  function focusApp(id) {
    const win = openApps.get(id); if (!win) return;
    win.style.zIndex = ++zIndex; setActiveTask(id);
  }
  function setActiveTask(id) {
    document.querySelectorAll(".task-app").forEach(function (t) {
      t.classList.toggle("active", t.dataset.task === id);
    });
  }
  function addTaskItem(id, meta) {
    const item = document.createElement("button");
    item.className = "task-app"; item.dataset.task = id;
    item.setAttribute("aria-label", meta.title);
    item.innerHTML = '<i class="' + meta.icon + '"></i>';
    item.addEventListener("click", function () {
      const win = openApps.get(id); if (!win) return;
      if (win.classList.contains("minimized")) { win.classList.remove("minimized"); focusApp(id); }
      else if (win.style.zIndex === String(zIndex)) { win.classList.add("minimized"); setActiveTask(null); }
      else { focusApp(id); }
    });
    taskbar.appendChild(item);
  }

  /* ---------- Dragging ---------- */
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
      try { handle.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }

  /* ---------- Terminal ---------- */
  function runTerminal(host, mode) {
    const isLinux = mode === "linux";
    const prompt = isLinux ? "sina@srxl:~$" : "PS C:\\Users\\Sina>";
    const linuxScript = [
      { type: "cmd", text: "whoami" },
      { type: "out", text: "sina — red team operator, building a small C2" },
      { type: "cmd", text: "cat ~/notes/learning.md" },
      { type: "out", text: "lateral movement, philosophy, being a little better each day" },
      { type: "cmd", text: "uptime" },
      { type: "out", text: "up 3 days, enjoying the quiet" },
      { type: "cmd", text: "" }
    ];
    const windowsScript = [
      { type: "cmd", text: "whoami" },
      { type: "out", text: "desktop-7f2a\\sina" },
      { type: "cmd", text: "Get-Content .\\about.txt" },
      { type: "out", text: "red team operator — building a small C2, learning lateral movement" },
      { type: "cmd", text: "" }
    ];
    const script = isLinux ? linuxScript : windowsScript;
    let i = 0;
    (function next() {
      if (i >= script.length) {
        const caret = document.createElement("span");
        caret.className = "caret"; host.appendChild(caret); return;
      }
      const step = script[i++];
      const line = document.createElement("div");
      if (step.type === "cmd") {
        const p = document.createElement("span");
        p.className = "prompt"; p.textContent = prompt;
        line.appendChild(p);
        line.appendChild(document.createTextNode(" " + step.text));
      } else {
        line.className = "out soft"; line.textContent = step.text;
      }
      host.appendChild(line); host.scrollTop = host.scrollHeight;
      setTimeout(next, step.type === "cmd" ? 440 : 320);
    })();
  }

  /* ---------- Clock ---------- */
  function startClock() {
    const el = document.getElementById("clock");
    function tick() { el.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
    tick(); setInterval(tick, 15000);
  }

  /* ---------- Lightbox ---------- */
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
    lbList = list; lbIndex = Math.max(0, Math.min(index, list.length - 1));
    lastFocused = origin || document.activeElement;
    renderLb(); lightbox.hidden = false;
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
    const item = lbList[lbIndex]; if (!item) return;
    lbImage.src = item.src; lbImage.alt = item.caption || "";
    lbCaption.textContent = item.caption || "";
    lbCounter.textContent = (lbIndex + 1) + " / " + lbList.length;
    const many = lbList.length > 1;
    lbPrev.style.display = many ? "" : "none";
    lbNext.style.display = many ? "" : "none";
  }
  function nextLb() { if (!lbList.length) return; lbIndex = (lbIndex + 1) % lbList.length; animateSwap(); renderLb(); }
  function prevLb() { if (!lbList.length) return; lbIndex = (lbIndex - 1 + lbList.length) % lbList.length; animateSwap(); renderLb(); }
  function animateSwap() {
    lbImage.style.transition = "opacity .18s"; lbImage.style.opacity = "0";
    setTimeout(function () { lbImage.style.opacity = "1"; }, 100);
  }
  document.addEventListener("click", function (e) {
    const shot = e.target.closest(".shot[data-full]"); if (!shot) return;
    e.preventDefault();
    const gallery = shot.closest(".gallery");
    const siblings = gallery ? Array.from(gallery.querySelectorAll(".shot[data-full]")) : [shot];
    openLightbox(
      siblings.map(function (el) { return { src: el.dataset.full, caption: el.dataset.caption || "" }; }),
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
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    const shot = document.activeElement && document.activeElement.closest
      ? document.activeElement.closest(".shot[data-full]") : null;
    if (!shot) return; e.preventDefault(); shot.click();
  });

  /* ---------- Wire up icons ---------- */
  document.querySelectorAll("[data-open]").forEach(function (btn) {
    btn.addEventListener("click", function () { openApp(btn.dataset.open); });
    btn.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openApp(btn.dataset.open); }
    });
  });

  const observer = new MutationObserver(function () {
    if (desk.classList.contains("show")) {
      observer.disconnect();
      setTimeout(function () { openApp("about"); }, 750);
    }
  });
  observer.observe(desk, { attributes: true, attributeFilter: ["class"] });
})();