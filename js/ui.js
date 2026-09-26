/* ============================================================
   HT-UI — Shared UI utilities for Heat Treatment system.
   Provides: auth guard, sidebar toggle (desktop + mobile drawer),
   modal open/close, toast notifications, QR scanner lifecycle,
   and form helper utilities. All logic stays in-page; this only
   centralizes presentation/state helpers so pages stay consistent.
   ============================================================ */

const HTUI = {
  /* ---- Sidebar ---- */
  initSidebar() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    const stored = localStorage.getItem("htSidebarCollapsed");
    if (stored === "true") sidebar.classList.add("collapsed");
  },

  toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    if (!sidebar) return;
    sidebar.classList.toggle("open");
    sidebar.classList.toggle("collapsed");
    if (overlay) overlay.classList.toggle("active");
    if (sidebar.classList.contains("open") || sidebar.classList.contains("collapsed")) {
      localStorage.setItem("htSidebarCollapsed", "true");
    } else {
      localStorage.setItem("htSidebarCollapsed", "false");
    }
  },

  closeSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    if (!sidebar) return;
    sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("active");
  },

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
    const iconMap = {
      success: "check-circle",
      error: "error",
      warning: "warning"
    };
    const iconName = iconMap[type] || "info";
    el.innerHTML =
      '<img src="assets/icons/' + iconName + '.svg" alt="" class="icon icon-sm mr-2">' +
      message;
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
  if (!document.getElementById("sidebarOverlay")) {
    const overlay = document.createElement("div");
    overlay.id = "sidebarOverlay";
    overlay.className = "ht-overlay";
    overlay.setAttribute("onclick", "HTUI.closeSidebar()");
    document.body.appendChild(overlay);
  }
  document.addEventListener("click", function (e) {
    const togglers = document.querySelectorAll("[data-sidebar-toggle]");
    togglers.forEach((b) => {
      if (b.contains(e.target) || e.target === b) {
        e.preventDefault();
        HTUI.toggleSidebar();
      }
    });
  });
  HTUI.initSidebar();
})();
