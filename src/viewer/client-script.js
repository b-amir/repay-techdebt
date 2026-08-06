// Vanilla client script injected into the shell. Mark done, live reload, view prefs, copy commands.
export const CLIENT_SCRIPT = `
(function () {
  var PREFS_KEY = "repay-viewer-prefs";
  var RECENT_KEY = "repay-viewer-recent";
  var HINTS_KEY = "repay-viewer-hints-seen";
  var DEFAULT_PREFS = {
    theme: "paper",
    scale: "m",
    accent: "teal",
    themeChosen: false,
    sidebarCollapsed: false,
    focusMode: false,
    navFilter: "all",
  };

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

  function isTypingTarget(el) {
    if (!el) return false;
    var tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }

  function applyPrefs(prefs) {
    var root = document.documentElement;
    var theme = effectiveTheme(prefs);
    root.setAttribute("data-theme", theme);
    root.setAttribute("data-scale", prefs.scale || "m");
    root.setAttribute("data-accent", prefs.accent || "teal");
    root.setAttribute("data-sidebar", prefs.sidebarCollapsed ? "collapsed" : "open");
    root.setAttribute("data-focus", prefs.focusMode ? "on" : "off");
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
    var exit = document.querySelector(".ds-focus-exit");
    if (exit) exit.hidden = !prefs.focusMode;
    applyNavFilter(prefs.navFilter || "all");
    renderMermaid(false);
  }

  function renderMermaid(force) {
    if (!window.mermaid) return;
    var theme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "neutral";
    window.mermaid.initialize({
      startOnLoad: false,
      theme: theme,
      securityLevel: "strict",
      fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
    });
    var selector = force
      ? ".ds-mermaid-wrap .mermaid"
      : ".ds-mermaid-wrap .mermaid:not([data-processed])";
    var nodes = document.querySelectorAll(selector);
    if (!nodes.length) return;
    if (force) {
      nodes.forEach(function (node) {
        if (node.dataset.mermaidSource) {
          node.removeAttribute("data-processed");
          node.removeAttribute("data-processed-by");
          node.innerHTML = node.dataset.mermaidSource;
        } else if (!node.dataset.mermaidSource) {
          node.dataset.mermaidSource = node.textContent || "";
        }
      });
    } else {
      nodes.forEach(function (node) {
        if (!node.dataset.mermaidSource) node.dataset.mermaidSource = node.textContent || "";
      });
    }
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
          applyPrefs(next);
          renderMermaid(true);
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

  function toggleSidebar() {
    var prefs = readPrefs();
    prefs.sidebarCollapsed = !prefs.sidebarCollapsed;
    writePrefs(prefs);
    applyPrefs(prefs);
  }

  function bindSidebarToggle() {
    document.querySelectorAll(".ds-sidebar-toggle").forEach(function (btn) {
      btn.addEventListener("click", function () {
        toggleSidebar();
      });
    });
  }

  function applyNavFilter(filter) {
    document.querySelectorAll(".ds-filter-btn").forEach(function (btn) {
      var active = btn.getAttribute("data-filter") === filter;
      btn.classList.toggle("ds-filter-btn-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    document.querySelectorAll(".ds-nav-list a.ds-nav, .ds-nav-list a.ds-nav-planned").forEach(function (a) {
      var state = a.getAttribute("data-nav-state") || "open";
      var show = filter === "all" || state === filter;
      a.hidden = !show;
    });
    document.querySelectorAll(".ds-chapter").forEach(function (chapter) {
      var visible = chapter.querySelectorAll("a.ds-nav:not([hidden]), a.ds-nav-planned:not([hidden])").length > 0;
      chapter.hidden = !visible;
    });
  }

  function bindNavFilter() {
    document.querySelectorAll(".ds-filter-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var filter = btn.getAttribute("data-filter") || "all";
        var prefs = readPrefs();
        prefs.navFilter = filter;
        writePrefs(prefs);
        applyNavFilter(filter);
      });
    });
  }

  function bindCopyButtons() {
    var copyCheckIcon =
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<path d="M3.5 8.5l3 3 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</svg>";

    document.querySelectorAll(".ds-btn-copy").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var row = btn.closest(".ds-create-row") || btn.closest(".ds-cmd-row");
        var block = btn.closest(".ds-codeblock");
        var code =
          (row && (row.querySelector("code") || row.querySelector(".ds-cmd-text"))) ||
          (block && block.querySelector("code"));
        var explicit = btn.getAttribute("data-copy");
        var text = explicit || (code && code.textContent) || "";
        if (!text) return;
        var isIcon = btn.classList.contains("ds-btn-copy-icon");
        function done() {
          if (isIcon) {
            if (!btn.dataset.copyIcon) btn.dataset.copyIcon = btn.innerHTML;
            btn.innerHTML = copyCheckIcon;
          } else {
            btn.dataset.copyText = btn.textContent;
            btn.textContent = "Copied";
          }
          btn.classList.add("ds-btn-copy-done");
          setTimeout(function () {
            if (isIcon && btn.dataset.copyIcon) {
              btn.innerHTML = btn.dataset.copyIcon;
            } else if (btn.dataset.copyText) {
              btn.textContent = btn.dataset.copyText;
            }
            btn.classList.remove("ds-btn-copy-done");
          }, 2000);
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

  function readRecent() {
    try {
      var raw = sessionStorage.getItem(RECENT_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function pushRecent(entry) {
    if (!entry || !entry.href || !entry.title) return;
    var list = readRecent().filter(function (item) {
      return item.href !== entry.href;
    });
    list.unshift({ href: entry.href, title: entry.title, key: entry.key || "" });
    try {
      sessionStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
    } catch (e) { /* ignore */ }
  }

  function trackCurrentLesson() {
    var btn = document.querySelector(".ds-mark-done");
    if (!btn) return;
    var key = btn.getAttribute("data-lesson") || "";
    var titleEl = document.querySelector(".ds-lesson-title");
    var title = titleEl ? titleEl.textContent : key;
    pushRecent({
      key: key,
      title: title,
      href: "/lesson/" + encodeURIComponent(key),
    });
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
        var pct = max > 0 ? (window.scrollY / max) : 0;
        bar.style.transform = "scaleX(" + Math.min(1, Math.max(0, pct)) + ")";
      }

      var found = null;
      var scrollOffset = 96;
      var bottomOffset = 160;
      var nearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - bottomOffset;
      if (nearBottom && headings.length) {
        found = headings[headings.length - 1];
      } else {
        for (var i = 0; i < headings.length; i++) {
          var rect = headings[i].getBoundingClientRect();
          if (rect.top <= scrollOffset) found = headings[i];
        }
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
    t.setAttribute("role", "status");
    t.innerHTML = 'Lesson updated — <button type="button" class="ds-btn-reload">Refresh</button>';
    document.body.appendChild(t);
    t.querySelector(".ds-btn-reload").addEventListener("click", function() {
      window.location.reload();
    });
  }

  function updateCompletionUi(btn, completed, counts) {
    btn.setAttribute("data-completed", completed ? "true" : "false");
    btn.setAttribute("aria-pressed", completed ? "true" : "false");
    var label = btn.querySelector(".ds-mark-done-label");
    if (label) label.textContent = completed ? "Mark not done" : "Mark as done";
    btn.className = completed ? "ds-mark-done ds-mark-done-complete" : "ds-mark-done";
    btn.disabled = false;
    var strip = document.querySelector(".ds-orientation-strip");
    if (strip) {
      strip.textContent = strip.textContent.replace(/· (Open|Done)\\b/, "· " + (completed ? "Done" : "Open"));
    }
    var nav = document.querySelector(".ds-nav-current");
    if (nav) {
      nav.classList.toggle("ds-nav-done", completed);
      nav.setAttribute("data-nav-state", completed ? "done" : "open");
      var mark = nav.querySelector(".ds-nav-mark");
      if (mark) {
        mark.className = completed ? "ds-nav-mark ds-nav-mark-done" : "ds-nav-mark ds-nav-mark-dot";
        mark.textContent = completed ? "" : "·";
      }
    }
    if (counts) {
      var doneEl = document.querySelector(".ds-stats-item .ds-stats-value");
      if (doneEl) doneEl.textContent = counts.done;
    }
  }

  function toggleCompletion() {
    var btn = document.querySelector(".ds-mark-done");
    if (!btn || btn.disabled) return;
    btn.click();
  }

  function navigateTo(href) {
    if (!href) return;
    saveNavScroll();
    window.location.href = href;
  }

  function goNeighbor(dir) {
    var link = document.querySelector(".ds-lesson-nav-" + dir + "[href]");
    if (link) navigateTo(link.getAttribute("href"));
  }

  function toggleFocusMode() {
    var prefs = readPrefs();
    prefs.focusMode = !prefs.focusMode;
    writePrefs(prefs);
    applyPrefs(prefs);
  }

  function matchLabel(match) {
    if (!match) return "lesson";
    if (match === "primaryPath") return "path";
    if (match === "planned") return "planned";
    if (match === "recent") return "recent";
    if (match === "continue") return "continue";
    if (match === "jump") return "jump";
    return match;
  }

  function stateChip(state) {
    if (!state) return "";
    return '<span class="ds-search-chip ds-search-chip-' + state + '">' + state + "</span>";
  }

  function navCatalog() {
    var lessons = [];
    var planned = [];
    document.querySelectorAll(".ds-nav-list a.ds-nav, .ds-nav-list a.ds-nav-planned").forEach(function (a) {
      var title = a.getAttribute("data-nav-title") || (a.querySelector(".ds-nav-label") || a).textContent || "";
      var state = a.getAttribute("data-nav-state") || "open";
      var href = a.getAttribute("href") || "";
      var key = a.getAttribute("data-lesson-key") || "";
      var item = { title: title.trim(), state: state, href: href, key: key, match: state === "planned" ? "planned" : "title" };
      if (state === "planned") planned.push(item);
      else lessons.push(item);
    });
    return { lessons: lessons, planned: planned };
  }

  function continueEntry() {
    var last = document.documentElement.getAttribute("data-last-read") || "";
    if (!last) return null;
    var safe = String(last).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    var a = document.querySelector('.ds-nav-list a[data-lesson-key="' + safe + '"]');
    if (!a) {
      return {
        title: last.replace(/^lessons\\//, "").replace(/\\.md$/, ""),
        href: "/lesson/" + encodeURIComponent(last),
        key: last,
        match: "continue",
        state: "open",
      };
    }
    return {
      title: a.getAttribute("data-nav-title") || a.textContent.trim(),
      href: a.getAttribute("href"),
      key: last,
      match: "continue",
      state: a.getAttribute("data-nav-state") || "open",
    };
  }

  function bindSearchPalette(shortcutsApi) {
    var root = document.getElementById("ds-search-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "ds-search-root";
      root.className = "ds-search-root";
      root.innerHTML =
        '<div class="ds-search-backdrop"></div>' +
        '<div class="ds-search-panel" role="dialog" aria-modal="true" aria-label="Command palette">' +
        '<div class="ds-search-input-row">' +
        '<svg class="ds-search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.4"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' +
        '<input class="ds-search-input" type="search" placeholder="Search lessons, claims, paths…" aria-label="Search lessons and claims" autocomplete="off" spellcheck="false" />' +
        '<kbd class="ds-kbd ds-search-esc">esc</kbd>' +
        "</div>" +
        '<div class="ds-search-results-wrap"><ul class="ds-search-results" role="listbox" aria-label="Search results" id="ds-search-listbox"></ul></div>' +
        '<div class="ds-search-footer"><span><kbd class="ds-kbd">↑↓</kbd> move</span><span><kbd class="ds-kbd">↵</kbd> open</span><span><kbd class="ds-kbd">esc</kbd> close</span></div>' +
        "</div>";
      document.body.appendChild(root);
    }
    var panel = root.querySelector(".ds-search-panel");
    var input = root.querySelector(".ds-search-input");
    var results = root.querySelector(".ds-search-results");
    var backdrop = root.querySelector(".ds-search-backdrop");
    var timer = null;
    var activeIndex = -1;
    var rows = [];
    var lastFocus = null;

    function close() {
      root.classList.remove("ds-search-open");
      input.value = "";
      results.innerHTML = "";
      rows = [];
      activeIndex = -1;
      if (lastFocus && typeof lastFocus.focus === "function") {
        try { lastFocus.focus(); } catch (e) { /* ignore */ }
      }
      lastFocus = null;
    }

    function open() {
      lastFocus = document.activeElement;
      root.classList.add("ds-search-open");
      input.focus();
      runSearch("");
    }

    function isOpen() {
      return root.classList.contains("ds-search-open");
    }

    function setActive(idx) {
      if (!rows.length) {
        activeIndex = -1;
        input.removeAttribute("aria-activedescendant");
        return;
      }
      activeIndex = Math.max(0, Math.min(rows.length - 1, idx));
      rows.forEach(function (row, i) {
        row.classList.toggle("ds-search-active", i === activeIndex);
        if (i === activeIndex) {
          row.setAttribute("aria-selected", "true");
          input.setAttribute("aria-activedescendant", row.id);
        } else {
          row.removeAttribute("aria-selected");
        }
      });
      var active = rows[activeIndex];
      if (active) active.scrollIntoView({ block: "nearest" });
    }

    function appendGroup(label, items) {
      if (!items.length) return;
      var group = document.createElement("li");
      group.className = "ds-search-group";
      group.setAttribute("role", "presentation");
      group.innerHTML = '<div class="ds-search-group-label">' + label + "</div>";
      results.appendChild(group);
      items.forEach(function (item, i) {
        var li = document.createElement("li");
        li.setAttribute("role", "presentation");
        var a = document.createElement("a");
        a.href = item.href || "#";
        a.className = "ds-search-row";
        a.id = "ds-search-opt-" + rows.length + "-" + i;
        a.setAttribute("role", "option");
        if (item.onPick) a._onPick = item.onPick;
        var title = document.createElement("span");
        title.className = "ds-search-row-title";
        title.textContent = item.title;
        var meta = document.createElement("span");
        meta.className = "ds-search-row-meta";
        meta.innerHTML = matchLabel(item.match) + (item.state ? " " + stateChip(item.state) : "");
        a.appendChild(title);
        a.appendChild(meta);
        if (item.snippet) {
          var snip = document.createElement("span");
          snip.className = "ds-search-row-snippet";
          snip.textContent = item.snippet;
          a.appendChild(snip);
        }
        a.addEventListener("click", function (e) {
          e.preventDefault();
          if (a._onPick) {
            a._onPick();
            return;
          }
          navigateTo(a.getAttribute("href"));
        });
        li.appendChild(a);
        results.appendChild(li);
        rows.push(a);
      });
    }

    function renderEmptyQuery() {
      results.innerHTML = "";
      rows = [];
      activeIndex = -1;
      var cont = continueEntry();
      if (cont) appendGroup("Continue", [cont]);
      var recent = readRecent().slice(0, 5).map(function (item) {
        return {
          title: item.title,
          href: item.href,
          key: item.key,
          match: "recent",
          state: "open",
        };
      });
      if (recent.length) appendGroup("Recent", recent);
      var catalog = navCatalog();
      if (catalog.planned.length) {
        appendGroup(
          "Planned",
          catalog.planned.slice(0, 6).map(function (p) {
            return Object.assign({}, p, { match: "planned", state: "planned" });
          }),
        );
      }
      appendGroup("Jump", [
        { title: "Home", href: "/", match: "jump" },
        {
          title: "Keyboard shortcuts",
          href: "#",
          match: "jump",
          onPick: function () {
            close();
            shortcutsApi.open();
          },
        },
      ]);
      if (rows.length) setActive(0);
      else {
        var empty = document.createElement("li");
        empty.className = "ds-search-empty";
        empty.textContent = "Type to search lessons and claims";
        results.appendChild(empty);
      }
    }

    function runSearch(q) {
      var query = String(q || "").trim();
      if (!query) {
        renderEmptyQuery();
        return;
      }
      var catalog = navCatalog();
      fetch("/api/search?q=" + encodeURIComponent(query))
        .then(function(r) { return r.ok ? r.json() : { results: [], claimHits: [] }; })
        .then(function(data) {
          results.innerHTML = "";
          rows = [];
          activeIndex = -1;
          var lessons = [];
          var claims = [];
          var seenLesson = {};
          var stateByKey = {};
          catalog.lessons.forEach(function (l) {
            if (l.key) stateByKey[l.key] = l.state;
          });
          function isClaimish(match) {
            return match === "claim" || match === "citation" || match === "path" || match === "primaryPath";
          }
          (data.results || []).forEach(function (item) {
            var row = {
              title: item.title,
              href: "/lesson/" + encodeURIComponent(item.key),
              key: item.key,
              match: item.match,
              snippet: item.snippet || "",
              state: stateByKey[item.key] || "open",
            };
            if (isClaimish(item.match)) claims.push(row);
            else {
              lessons.push(row);
              seenLesson[item.key] = true;
            }
          });
          (data.claimHits || []).forEach(function (hit) {
            if (!isClaimish(hit.match) && seenLesson[hit.key] && !hit.snippet) return;
            claims.push({
              title: hit.title,
              href: "/lesson/" + encodeURIComponent(hit.key),
              key: hit.key,
              match: hit.match,
              snippet: hit.snippet || "",
              state: stateByKey[hit.key] || "open",
            });
          });
          var claimSeen = {};
          claims = claims.filter(function (c) {
            var k = c.key + "|" + (c.snippet || c.match || "");
            if (claimSeen[k]) return false;
            claimSeen[k] = true;
            return true;
          });
          var qLow = query.toLowerCase();
          var plannedHits = catalog.planned.filter(function (p) {
            return p.title.toLowerCase().indexOf(qLow) !== -1;
          }).map(function (p) {
            return Object.assign({}, p, { match: "planned", state: "planned" });
          });
          if (!lessons.length && !claims.length && !plannedHits.length) {
            var empty = document.createElement("li");
            empty.className = "ds-search-empty";
            empty.textContent = "No matches";
            results.appendChild(empty);
            return;
          }
          appendGroup("Lessons", lessons.slice(0, 8));
          appendGroup("Claims & paths", claims.slice(0, 8));
          appendGroup("Planned", plannedHits.slice(0, 8));
          setActive(0);
        })
        .catch(function() {});
    }

    function trapTab(e) {
      if (!isOpen() || e.key !== "Tab") return;
      var focusables = [input].concat(rows);
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    backdrop.addEventListener("click", close);
    input.addEventListener("input", function() {
      clearTimeout(timer);
      timer = setTimeout(function() { runSearch(input.value); }, 100);
    });
    input.addEventListener("keydown", function(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive(activeIndex < 0 ? 0 : activeIndex + 1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive(activeIndex < 0 ? 0 : activeIndex - 1);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        var target = rows[activeIndex] || rows[0];
        if (!target) return;
        if (target._onPick) {
          target._onPick();
          return;
        }
        navigateTo(target.getAttribute("href"));
      }
    });
    panel.addEventListener("keydown", trapTab);

    document.querySelectorAll("[data-open-search]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        open();
      });
    });

    document.addEventListener("keydown", function (e) {
      if (isTypingTarget(e.target) && e.key !== "Escape") return;
      var mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen()) close();
        else open();
        return;
      }
      if (e.key === "/" && !mod && !e.altKey) {
        e.preventDefault();
        open();
        return;
      }
      if (e.key === "Escape" && isOpen()) {
        e.preventDefault();
        close();
      }
    });

    return { open: open, close: close, isOpen: isOpen };
  }

  function bindShortcutsSheet() {
    var root = document.getElementById("ds-shortcuts-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "ds-shortcuts-root";
      root.className = "ds-shortcuts-root";
      root.innerHTML =
        '<div class="ds-shortcuts-backdrop"></div>' +
        '<div class="ds-shortcuts-panel" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">' +
        '<div class="ds-shortcuts-head"><h2 class="ds-shortcuts-title">Shortcuts</h2><button type="button" class="ds-shortcuts-close" aria-label="Close">×</button></div>' +
        '<dl class="ds-shortcuts-list">' +
        "<div><dt><kbd class=\\"ds-kbd\\">/</kbd> or <kbd class=\\"ds-kbd\\">⌘K</kbd></dt><dd>Command palette</dd></div>" +
        "<div><dt><kbd class=\\"ds-kbd\\">j</kbd> / <kbd class=\\"ds-kbd\\">→</kbd> / <kbd class=\\"ds-kbd\\">]</kbd></dt><dd>Next lesson</dd></div>" +
        "<div><dt><kbd class=\\"ds-kbd\\">k</kbd> / <kbd class=\\"ds-kbd\\">←</kbd> / <kbd class=\\"ds-kbd\\">[</kbd></dt><dd>Previous lesson</dd></div>" +
        "<div><dt><kbd class=\\"ds-kbd\\">d</kbd></dt><dd>Toggle mark done</dd></div>" +
        "<div><dt><kbd class=\\"ds-kbd\\">f</kbd></dt><dd>Focus mode</dd></div>" +
        "<div><dt><kbd class=\\"ds-kbd\\">s</kbd></dt><dd>Toggle sidebar</dd></div>" +
        "<div><dt><kbd class=\\"ds-kbd\\">?</kbd></dt><dd>This sheet</dd></div>" +
        "<div><dt><kbd class=\\"ds-kbd\\">esc</kbd></dt><dd>Close overlay / exit focus</dd></div>" +
        "</dl></div>";
      document.body.appendChild(root);
    }
    var backdrop = root.querySelector(".ds-shortcuts-backdrop");
    var closeBtn = root.querySelector(".ds-shortcuts-close");
    function close() { root.classList.remove("ds-shortcuts-open"); }
    function open() { root.classList.add("ds-shortcuts-open"); }
    function isOpen() { return root.classList.contains("ds-shortcuts-open"); }
    backdrop.addEventListener("click", close);
    closeBtn.addEventListener("click", close);
    return { open: open, close: close, isOpen: isOpen };
  }

  function bindFocusExit() {
    var exit = document.querySelector(".ds-focus-exit");
    if (!exit) {
      exit = document.createElement("button");
      exit.type = "button";
      exit.className = "ds-focus-exit";
      exit.setAttribute("aria-label", "Exit focus mode");
      exit.textContent = "Exit focus";
      exit.hidden = true;
      document.body.appendChild(exit);
    }
    exit.addEventListener("click", function () {
      var prefs = readPrefs();
      prefs.focusMode = false;
      writePrefs(prefs);
      applyPrefs(prefs);
    });
  }

  function bindHints() {
    if (!document.querySelector(".ds-mark-done")) return;
    try {
      if (localStorage.getItem(HINTS_KEY) === "1") return;
    } catch (e) { /* ignore */ }
    var el = document.createElement("div");
    el.className = "ds-kbd-hints";
    el.setAttribute("role", "status");
    el.innerHTML =
      '<span><kbd class="ds-kbd">j</kbd><kbd class="ds-kbd">k</kbd> lessons</span>' +
      '<span><kbd class="ds-kbd">d</kbd> done</span>' +
      '<span><kbd class="ds-kbd">f</kbd> focus</span>' +
      '<span><kbd class="ds-kbd">/</kbd> search</span>' +
      '<span><kbd class="ds-kbd">?</kbd> more</span>';
    document.body.appendChild(el);
    setTimeout(function () {
      el.classList.add("ds-kbd-hints-hide");
      try { localStorage.setItem(HINTS_KEY, "1"); } catch (e) { /* ignore */ }
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 500);
    }, 4500);
  }

  function bindGlobalKeys(searchApi, shortcutsApi) {
    document.addEventListener("keydown", function (e) {
      if (isTypingTarget(e.target)) return;
      if (searchApi.isOpen() || shortcutsApi.isOpen()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "j" || e.key === "ArrowRight" || e.key === "]") {
        e.preventDefault();
        goNeighbor("next");
        return;
      }
      if (e.key === "k" || e.key === "ArrowLeft" || e.key === "[") {
        e.preventDefault();
        goNeighbor("prev");
        return;
      }
      if (e.key === "d") {
        e.preventDefault();
        toggleCompletion();
        return;
      }
      if (e.key === "f") {
        e.preventDefault();
        toggleFocusMode();
        return;
      }
      if (e.key === "s") {
        e.preventDefault();
        toggleSidebar();
        return;
      }
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        shortcutsApi.open();
        return;
      }
      if (e.key === "Escape") {
        var prefs = readPrefs();
        if (prefs.focusMode) {
          e.preventDefault();
          prefs.focusMode = false;
          writePrefs(prefs);
          applyPrefs(prefs);
        }
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && shortcutsApi.isOpen()) {
        e.preventDefault();
        shortcutsApi.close();
      }
    });
  }

  function bindLiveReload() {
    var btn = document.querySelector(".ds-mark-done");
    var plaque = document.querySelector(".ds-plaque-body");
    if (!plaque || !btn) return;
    var lastMtime = null;
    setInterval(function () {
      if (document.hidden) return;
      var key = btn.getAttribute("data-lesson");
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

  ready(function () {
    bindPrefs();
    bindSettingsPanel();
    bindSidebarToggle();
    bindNavFilter();
    bindCopyButtons();
    bindNavScroll();
    bindReadingScroll();
    bindFocusExit();
    trackCurrentLesson();
    var shortcutsApi = bindShortcutsSheet();
    var searchApi = bindSearchPalette(shortcutsApi);
    bindGlobalKeys(searchApi, shortcutsApi);
    bindHints();
    bindLiveReload();
    renderMermaid(false);

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
  });
})();
`;
