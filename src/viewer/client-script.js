// Vanilla client script injected into the shell. No framework, no fetch of remote
// assets. Two jobs: toggle Mark done against the loopback API (and reflect the new
// state in the button + directory check), and poll the lesson file mtime so an
// external re-save live-reloads the open plaque. Exported as a string so the
// orphan/import hygiene test sees a normal imported module, not a loose asset.
export const CLIENT_SCRIPT = `
(function () {
  function ready(fn) { if (document.readyState !== "loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }
  ready(function () {
    var btn = document.querySelector(".ds-mark-done");
    if (btn) {
      btn.addEventListener("click", function () {
        var lesson = btn.getAttribute("data-lesson");
        var completed = btn.getAttribute("data-completed") === "true";
        btn.disabled = true;
        fetch("/api/completion", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: lesson, completed: !completed }) })
          .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("completion failed")); })
          .then(function (state) { window.location.reload(); })
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
            if (data && data.mtimeMs && lastMtime && data.mtimeMs !== lastMtime) window.location.reload();
            if (data && data.mtimeMs) lastMtime = data.mtimeMs;
          })
          .catch(function () {});
      }, 4000);
    }
  });
})();
`;
