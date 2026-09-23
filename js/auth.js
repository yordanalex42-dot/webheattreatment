const Auth = {
  sessionKey: "ht_session",

  login(username, password) {
    const users = this.getUsers();
    const user = users.find(
      (u) => u.username === username && u.password === password,
    );
    if (user) {
      localStorage.setItem(
        this.sessionKey,
        JSON.stringify({ username: user.username, name: user.name, role: user.role }),
      );
      return true;
    }
    return false;
  },

  logout() {
    localStorage.removeItem(this.sessionKey);
  },

  getSession() {
    const s = localStorage.getItem(this.sessionKey);
    return s ? JSON.parse(s) : null;
  },

  isLoggedIn() {
    return !!this.getSession();
  },

  getUsers() {
    return JSON.parse(localStorage.getItem("ht_users") || "[]");
  },

  getInitials(name) {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  },

  initDefaultUser() {
    if (this.getUsers().length === 0) {
      localStorage.setItem(
        "ht_users",
        JSON.stringify([
          { username: "admin", password: "admin123", name: "Admin User", role: "Administrator" },
        ]),
      );
    }
  },
};
