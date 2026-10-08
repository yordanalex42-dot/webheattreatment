HTDateFormat = {
  MONTH_NAMES_ID: [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ],
  DAY_NAMES_ID: [
    "Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"
  ],

  formatLongDate(date) {
    const formatter = new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta"
    });
    return formatter.format(date);
  },

  formatLongDateFromISO(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return this.formatLongDate(d);
  },

  formatLongDateTime(date) {
    const formatter = new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
      hour12: false
    });
    return formatter.format(date);
  },

  formatLongDateTimeFromISO(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return this.formatLongDateTime(d);
  },

  init() {
    const el = document.getElementById("currentDate");
    if (!el) return;
    const render = () => {
      el.textContent = this.formatLongDate(new Date());
    };
    render();
    setInterval(render, 60000);
  }
};

function formatDateLong(date) {
  if (!date) return "-";
  if (typeof date === "string") return HTDateFormat.formatLongDateFromISO(date);
  return HTDateFormat.formatLongDate(date);
}

function formatDateLongWithTime(date) {
  if (!date) return "-";
  if (typeof date === "string") return HTDateFormat.formatLongDateTimeFromISO(date);
  return HTDateFormat.formatLongDateTime(date);
}
