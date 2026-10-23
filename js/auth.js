const Auth = {
  sessionKey: "ht_session",

  ROLES: {
    ADMINISTRATOR: "Administrator",
    INSPECTOR_QC: "Inspector QC",
    LEADER_QC: "Leader QC",
    SUPERVISOR_QC: "Supervisor QC",
    OPERATOR_SHOTBLAST: "Operator Shotblast",
    OPERATOR_ANTI_RUST: "Operator Anti Rust",
    OPERATOR_DELIVERY: "Operator Delivery",
  },

  login(username, password) {
    const users = this.getUsers();
    const user = users.find(
      (u) => u.username === username && u.password === password,
    );
    if (user) {
      localStorage.setItem(
        this.sessionKey,
        JSON.stringify({
          username: user.username,
          name: user.name,
          role: user.role,
        }),
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
      const R = this.ROLES;
      localStorage.setItem(
        "ht_users",
        JSON.stringify([
          {
            username: "admin",
            password: "admin123",
            name: "Admin User",
            role: R.ADMINISTRATOR,
          },
          {
            username: "inspector",
            password: "inspector123",
            name: "Inspector QC",
            role: R.INSPECTOR_QC,
          },
          {
            username: "leader",
            password: "leader123",
            name: "Leader QC",
            role: R.LEADER_QC,
          },
          {
            username: "supervisor",
            password: "supervisor123",
            name: "Supervisor QC",
            role: R.SUPERVISOR_QC,
          },
          {
            username: "shotblast",
            password: "shotblast123",
            name: "Operator Shotblast",
            role: R.OPERATOR_SHOTBLAST,
          },
          {
            username: "antirust",
            password: "antirust123",
            name: "Operator Anti Rust",
            role: R.OPERATOR_ANTI_RUST,
          },
          {
            username: "delivery",
            password: "delivery123",
            name: "Operator Delivery",
            role: R.OPERATOR_DELIVERY,
          },
        ]),
      );
    }
  },

  hasRole(roleOrRoles) {
    const session = this.getSession();
    if (!session) return false;
    const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
    return roles.indexOf(session.role) !== -1;
  },

  requireRole(roleOrRoles) {
    return this.hasRole(roleOrRoles);
  },
};
