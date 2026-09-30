/* ============================================================
   HT-UI — Shared UI utilities for Heat Treatment system.
   Provides: auth guard, modal open/close, toast notifications,
   QR scanner lifecycle, and form helper utilities.
   ============================================================ */

const HTUI = {
  /* ---- Auth guard ---- */
  requireAuth() {
    if (typeof Auth === "undefined") return false;
    Auth.initDefaultUser();
    if (!Auth.isLoggedIn()) {
      window.location.href = "login.html";
      return false;
    }
    const session = Auth.getSession();
    if (session) {
      const initial = document.getElementById("sidebarInitial");
      const name = document.getElementById("sidebarName");
      const role = document.getElementById("sidebarRole");
      if (initial) initial.textContent = Auth.getInitials(session.name);
      if (name) name.textContent = session.name;
      if (role) role.textContent = session.role;
    }
    return true;
  },

  /* ---- Date ---- */
  initDate() {
    const el = document.getElementById("currentDate");
    if (!el) return;
    const render = () => {
      const now = new Date();
      const options = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      };
      el.textContent = now.toLocaleDateString("id-ID", options);
    };
    render();
    setInterval(render, 60000);
  },

  /* ---- Modals ---- */
  openModal(modalId) {
    const modal =
      typeof modalId === "string"
        ? document.getElementById(modalId)
        : modalId;
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.classList.add("active");
  },

  closeModal(modalId) {
    const modal =
      typeof modalId === "string"
        ? document.getElementById(modalId)
        : modalId;
    if (!modal) return;
    modal.classList.remove("active");
    modal.classList.add("hidden");
  },

  /* ---- Toast ---- */
  toast(message, type = "success", duration = 3200) {
    let container = document.getElementById("ht-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "ht-toast-container";
      container.className = "ht-toast-container";
      document.body.appendChild(container);
    }
    const el = document.createElement("div");
    el.className = "ht-toast " + (type || "success");

    var iconName = "info";
    var titleText = "";
    if (type === "success") { iconName = "check-circle"; titleText = "Berhasil"; }
    else if (type === "error") { iconName = "error"; titleText = "Gagal"; }
    else if (type === "warning") { iconName = "warning"; titleText = "Peringatan"; }
    else if (type === "info") { iconName = "info"; titleText = "Informasi"; }

    el.innerHTML =
      '<img src="assets/icons/' + iconName + '.svg" alt="" class="ht-toast-icon">' +
      '<div class="ht-toast-content">' +
        '<div class="ht-toast-title">' + titleText + '</div>' +
        '<div class="ht-toast-msg">' + message + '</div>' +
      '</div>';

    container.appendChild(el);
    setTimeout(() => el.classList.add("show"), 10);
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 300);
    }, duration);
  },

  /* ---- QR Scanner lifecycle ---- */
  createScanner(elementId) {
    if (!window.Html5Qrcode) {
      this.toast("Kamera tidak tersedia di browser ini.", "error");
      return null;
    }
    return new Html5Qrcode(elementId);
  },

  startScanner(scanner, onDecode, options = {}) {
    const cfg = Object.assign(
      { fps: 10, qrbox: { width: 240, height: 240 } },
      options,
    );
    return scanner
      .start(
        { facingMode: "environment" },
        cfg,
        (decodedText) => {
          scanner.stop().then(() => {
            scanner.clear();
          }).catch(() => {});
          if (onDecode) onDecode(decodedText);
        },
        (err) => {
          if (console && console.warn) console.warn("[scanner]", err);
        },
      )
      .catch((err) => {
        console.error("[scanner] start failed:", err);
        HTUI.toast(
          "Scanner tidak dapat diakses. Pastikan kamera sudah diizinkan.",
          "error",
        );
      });
  },

  stopScanner(scanner) {
    if (scanner) {
      scanner
        .stop()
        .then(() => {
          scanner.clear();
          scanner.clear();
        })
        .catch(() => {});
    }
  },

  /* ---- Utility ---- */
  parseScanId(text) {
    if (text && text.includes("id=")) {
      return text.split("id=")[1].split("&")[0];
    }
    if (!text) return "";
    return text.split("/").pop();
  },

  findMaterial(query) {
    if (!query) return null;
    return DB.findByKode(query) || DB.findMaterial(query);
  },
};

/* ---- Global bootstrap ---- */
(function () {
  /* Opened straight from disk (no web server): external SVGs used as CSS
     masks are blocked by CORS, which hides masked icons. This class lets
     css/icons.css fall back to a scoped filter. Inert over http(s). */
  if (location.protocol === "file:") {
    document.documentElement.classList.add("ht-file-protocol");
  }
})();
