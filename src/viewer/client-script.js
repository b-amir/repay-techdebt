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
        var code = row && row.querySelector("code");
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

  ready(function () {
    bindPrefs();
    bindSettingsPanel();
    bindSidebarToggle();
    bindCopyButtons();
    renderMermaid();

    var btn = document.querySelector(".ds-mark-done");
    if (btn) {
      btn.addEventListener("click", function () {
        var lesson = btn.getAttribute("data-lesson");
        var completed = btn.getAttribute("data-completed") === "true";
        btn.disabled = true;
        fetch("/api/completion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: lesson, completed: !completed }),
        })
          .then(function (r) {
            return r.ok ? r.json() : Promise.reject(new Error("completion failed"));
          })
          .then(function () { window.location.reload(); })
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
              window.location.reload();
            }
            if (data && data.mtimeMs) lastMtime = data.mtimeMs;
          })
          .catch(function () {});
      }, 4000);
    }
  });
})();
`;
