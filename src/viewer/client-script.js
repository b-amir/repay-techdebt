// Vanilla client script injected into the shell. Mark done, live reload, view prefs, copy commands.
export const CLIENT_SCRIPT = `
(function () {
  var PREFS_KEY = "repay-viewer-prefs";
  var DEFAULT_PREFS = { theme: "paper", scale: "m", accent: "teal", themeChosen: false, sidebarCollapsed: false };

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  function readPrefs() {
    try {
      var raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return Object.assign({}, DEFAULT_PREFS);
      var parsed = JSON.parse(raw);
      return Object.assign({}, DEFAULT_PREFS, parsed);
    } catch (e) {
      return Object.assign({}, DEFAULT_PREFS);
    }
  }

  function writePrefs(prefs) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (e) { /* ignore */ }
  }

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function effectiveTheme(prefs) {
    if (prefs.themeChosen) return prefs.theme || "paper";
    return systemPrefersDark() ? "dark" : (prefs.theme || "paper");
  }

  function applyPrefs(prefs) {
    var root = document.documentElement;
    var theme = effectiveTheme(prefs);
    root.setAttribute("data-theme", theme);
    root.setAttribute("data-scale", prefs.scale || "m");
    root.setAttribute("data-accent", prefs.accent || "teal");
    root.setAttribute("data-sidebar", prefs.sidebarCollapsed ? "collapsed" : "open");
    var scheme = theme === "dark" ? "dark" : "light";
    root.style.colorScheme = scheme;
    var meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.setAttribute("content", scheme);
    document.querySelectorAll(".ds-seg-btn[data-pref]").forEach(function (btn) {
      var key = btn.getAttribute("data-pref");
      var val = btn.getAttribute("data-value");
      var active = key === "theme" ? theme === val : prefs[key] === val;
      btn.classList.toggle("ds-seg-btn-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    var collapsed = Boolean(prefs.sidebarCollapsed);
    document.querySelectorAll(".ds-sidebar-toggle").forEach(function (btn) {
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      btn.setAttribute("aria-label", collapsed ? "Show sidebar" : "Hide sidebar");
    });
    renderMermaid();
  }

  function renderMermaid() {
    if (!window.mermaid) return;
    var theme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "neutral";
    window.mermaid.initialize({
      startOnLoad: false,
      theme: theme,
      securityLevel: "strict",
      fontFamily: "Source Sans 3, system-ui, sans-serif",
    });
    var nodes = document.querySelectorAll(".ds-mermaid-wrap .mermaid:not([data-processed])");
    if (!nodes.length) return;
    window.mermaid.run({ nodes: nodes })
      .then(function () {
        nodes.forEach(function (node) {
          node.setAttribute("data-processed", "true");
        });
      })
      .catch(function (err) {
        console.error("mermaid render failed", err);
      });
  }

  function bindPrefs() {
    var prefs = readPrefs();
    applyPrefs(prefs);
    document.querySelectorAll(".ds-seg-btn[data-pref]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-pref");
        var val = btn.getAttribute("data-value");
        if (!key || !val) return;
        var next = readPrefs();
        next[key] = val;
        if (key === "theme") next.themeChosen = true;
        writePrefs(next);
        if (key === "theme" && document.querySelector(".ds-mermaid-wrap")) {
          window.location.reload();
          return;
        }
        applyPrefs(next);
      });
    });
    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
        var p = readPrefs();
        if (!p.themeChosen) applyPrefs(p);
      });
    }
  }

  function bindSettingsPanel() {
    var gear = document.querySelector(".ds-settings-gear");
    var panel = document.querySelector(".ds-settings-panel");
    if (!gear || !panel) return;
    function close() {
      panel.classList.remove("ds-settings-panel-open");
      gear.setAttribute("aria-expanded", "false");
    }
    function open() {
      panel.classList.add("ds-settings-panel-open");
      gear.setAttribute("aria-expanded", "true");
    }
    gear.addEventListener("click", function (e) {
      e.stopPropagation();
      if (panel.classList.contains("ds-settings-panel-open")) close();
      else open();
    });
    panel.addEventListener("click", function (e) {
      e.stopPropagation();
    });
    document.addEventListener("click", function (e) {
      if (!panel.classList.contains("ds-settings-panel-open")) return;
      if (panel.contains(e.target) || gear.contains(e.target)) return;
      close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
  }

  function bindSidebarToggle() {
    document.querySelectorAll(".ds-sidebar-toggle").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var prefs = readPrefs();
        prefs.sidebarCollapsed = !prefs.sidebarCollapsed;
        writePrefs(prefs);
        applyPrefs(prefs);
      });
    });
  }

  function bindCopyButtons() {
    document.querySelectorAll(".ds-btn-copy").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var row = btn.closest(".ds-create-row");
        var block = btn.closest(".ds-codeblock");
        var code = (row && row.querySelector("code")) || (block && block.querySelector("code"));
        if (!code) return;
        var text = code.textContent || "";
        function done() {
          var prev = btn.textContent;
          btn.textContent = "Copied";
          btn.classList.add("ds-btn-copy-done");
          setTimeout(function () {
            btn.textContent = prev;
            btn.classList.remove("ds-btn-copy-done");
          }, 1600);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(function () {
            fallbackCopy(text);
            done();
          });
        } else {
          fallbackCopy(text);
          done();
        }
      });
    });
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  var NAV_SCROLL_KEY = "repay-viewer-nav-scroll";

  function saveNavScroll() {
    var list = document.querySelector(".ds-nav-list");
    if (!list) return;
    try {
      sessionStorage.setItem(NAV_SCROLL_KEY, String(list.scrollTop));
    } catch (e) { /* ignore */ }
  }

  function restoreNavScroll() {
    var list = document.querySelector(".ds-nav-list");
    if (!list) return;
    try {
      var raw = sessionStorage.getItem(NAV_SCROLL_KEY);
      if (raw != null) {
        var y = Number(raw);
        if (Number.isFinite(y)) list.scrollTop = y;
      }
    } catch (e) { /* ignore */ }
    var current = list.querySelector(".ds-nav-current");
    if (!current) return;
    var listRect = list.getBoundingClientRect();
    var itemRect = current.getBoundingClientRect();
    if (itemRect.top < listRect.top || itemRect.bottom > listRect.bottom) {
      current.scrollIntoView({ block: "nearest", inline: "nearest" });
      saveNavScroll();
    }
  }

  function bindNavScroll() {
    var list = document.querySelector(".ds-nav-list");
    if (!list) return;
    restoreNavScroll();
    list.addEventListener("scroll", saveNavScroll, { passive: true });
    list.querySelectorAll("a.ds-nav, a.ds-nav-planned").forEach(function (a) {
      a.addEventListener("click", saveNavScroll);
    });
    window.addEventListener("pagehide", saveNavScroll);
  }

  function bindReadingScroll() {
    var main = document.querySelector(".ds-main");
    if (!main) return;

    var btn = document.querySelector(".ds-mark-done");
    var lessonKey = btn ? btn.getAttribute("data-lesson") : "";
    if (!lessonKey) return;
    
    var scrollAttr = document.documentElement.getAttribute("data-last-scroll");
    if (scrollAttr) {
      if (/^heading-/.test(scrollAttr) || isNaN(Number(scrollAttr))) {
        var el = document.getElementById(scrollAttr);
        if (el) setTimeout(function(){ el.scrollIntoView({ behavior: "instant", block: "start" }); }, 10);
      } else {
        var y = Number(scrollAttr);
        if (y > 0) setTimeout(function(){ window.scrollTo({ top: y, behavior: "instant" }); }, 10);
      }
    }

    var headings = Array.from(document.querySelectorAll(".ds-section-heading"));
    var links = document.querySelectorAll(".ds-toc-link");
    var activeId = "";

    function updateScroll() {
      var bar = document.querySelector(".ds-reading-progress-bar");
      if (bar) {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        var pct = max > 0 ? (window.scrollY / max) * 100 : 0;
        bar.style.width = Math.min(100, Math.max(0, pct)) + "%";
      }

      var found = null;
      for (var i = 0; i < headings.length; i++) {
        var rect = headings[i].getBoundingClientRect();
        if (rect.top <= 120) found = headings[i];
      }
      var currentId = found ? found.id : "";
      if (currentId !== activeId) {
        activeId = currentId;
        links.forEach(function(l) {
          if (l.getAttribute("data-id") === activeId) {
            l.classList.add("ds-toc-link-active");
          } else {
            l.classList.remove("ds-toc-link-active");
          }
        });
      }

      if (window._readScrollTid) return;
      window._readScrollTid = setTimeout(function() {
        window._readScrollTid = null;
        var val = activeId || Math.round(window.scrollY);
        fetch("/api/progress-view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: lessonKey, lastScroll: val })
        }).catch(function(){});
      }, 1500);
    }

    document.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("pagehide", updateScroll);
    setTimeout(updateScroll, 100);
  }

  function showReloadToast() {
    if (document.getElementById("ds-reload-toast")) return;
    var t = document.createElement("div");
    t.id = "ds-reload-toast";
    t.className = "ds-reload-toast";
    t.innerHTML = 'Lesson updated &mdash; <button type="button" class="ds-btn-reload">Refresh</button>';
    document.body.appendChild(t);
    t.querySelector(".ds-btn-reload").addEventListener("click", function() {
      window.location.reload();
    });
  }

  function updateCompletionUi(btn, completed, counts) {
    btn.setAttribute("data-completed", completed ? "true" : "false");
    btn.setAttribute("aria-pressed", completed ? "true" : "false");
    var label = btn.querySelector(".ds-mark-done-label");
    var hint = btn.querySelector(".ds-mark-done-hint");
    if (label) label.textContent = completed ? "✓ Completed" : "Mark as done";
    if (hint) hint.textContent = completed ? "Tap to mark not done" : "Save your progress";
    btn.className = completed
      ? "ds-mark-done ds-mark-done-complete"
      : "ds-mark-done ds-mark-done-primary";
    btn.disabled = false;
    var strip = document.querySelector(".ds-orientation-strip");
    if (strip) {
      strip.textContent = strip.textContent.replace(/· (Open|Done)$/, "· " + (completed ? "Done" : "Open"));
    }
    var nav = document.querySelector(".ds-nav-current");
    if (nav) {
      nav.classList.toggle("ds-nav-done", completed);
      var mark = nav.querySelector(".ds-nav-mark");
      if (mark) {
        mark.textContent = completed ? "✓" : "";
        mark.classList.toggle("ds-nav-mark-done", completed);
      }
    }
    if (counts) {
      var doneEl = document.querySelector(".ds-stats-item .ds-stats-value");
      if (doneEl) doneEl.textContent = counts.done;
    }
  }

  function bindSearchPalette() {
    var root = document.getElementById("ds-search-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "ds-search-root";
      root.className = "ds-search-root";
      root.innerHTML = '<div class="ds-search-backdrop"></div><div class="ds-search-panel" role="dialog" aria-label="Search lessons"><input class="ds-search-input" type="search" placeholder="Search lessons…" aria-label="Search lessons" /><ul class="ds-search-results"></ul></div>';
      document.body.appendChild(root);
    }
    var input = root.querySelector(".ds-search-input");
    var results = root.querySelector(".ds-search-results");
    var backdrop = root.querySelector(".ds-search-backdrop");
    var timer = null;

    function close() {
      root.classList.remove("ds-search-open");
      input.value = "";
      results.innerHTML = "";
    }
    function open() {
      root.classList.add("ds-search-open");
      input.focus();
      runSearch("");
    }
    function runSearch(q) {
      fetch("/api/search?q=" + encodeURIComponent(q))
        .then(function(r) { return r.ok ? r.json() : { results: [] }; })
        .then(function(data) {
          results.innerHTML = "";
          (data.results || []).forEach(function(item) {
            var li = document.createElement("li");
            var a = document.createElement("a");
            a.href = "/lesson/" + encodeURIComponent(item.key);
            a.textContent = item.title;
            li.appendChild(a);
            results.appendChild(li);
          });
        })
        .catch(function() {});
    }

    backdrop.addEventListener("click", close);
    input.addEventListener("input", function() {
      clearTimeout(timer);
      timer = setTimeout(function() { runSearch(input.value); }, 120);
    });
    input.addEventListener("keydown", function(e) {
      if (e.key === "Escape") close();
      if (e.key === "Enter" && results.firstChild) {
        var link = results.querySelector("a");
        if (link) window.location.href = link.getAttribute("href");
      }
    });
    document.addEventListener("keydown", function(e) {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if (e.key === "/") {
        e.preventDefault();
        open();
      }
    });
  }

  ready(function () {
    bindPrefs();
    bindSettingsPanel();
    bindSidebarToggle();
    bindCopyButtons();
    bindNavScroll();
    bindReadingScroll();
    bindSearchPalette();
    renderMermaid();

    var btn = document.querySelector(".ds-mark-done");
    if (btn) {
      btn.addEventListener("click", function () {
        var lesson = btn.getAttribute("data-lesson");
        var completed = btn.getAttribute("data-completed") === "true";
        btn.disabled = true;
        saveNavScroll();
        fetch("/api/completion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: lesson, completed: !completed }),
        })
          .then(function (r) {
            return r.ok ? r.json() : Promise.reject(new Error("completion failed"));
          })
          .then(function (data) {
            updateCompletionUi(btn, data.completed, data.counts);
          })
          .catch(function () { btn.disabled = false; });
      });
    }

    var plaque = document.querySelector(".ds-plaque-body");
    if (plaque) {
      var lastMtime = null;
      setInterval(function () {
        var key = btn ? btn.getAttribute("data-lesson") : null;
        if (!key) return;
        fetch("/api/lesson-mtime?path=" + encodeURIComponent(key))
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (data) {
            if (data && data.mtimeMs && lastMtime && data.mtimeMs !== lastMtime) {
              saveNavScroll();
              showReloadToast();
            }
            if (data && data.mtimeMs) lastMtime = data.mtimeMs;
          })
          .catch(function () {});
      }, 4000);
    }
  });
})();
`;
