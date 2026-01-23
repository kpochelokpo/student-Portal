const { run } = require("../db/db");

const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    res.redirect("/login");
    return;
  }
  next();
};

const requireRole = (role) => (req, res, next) => {
  if (!req.session.user || req.session.user.role !== role) {
    res.status(403).render("auth/403");
    return;
  }
  next();
};

const logAction = async (userId, action) => {
  await run("INSERT INTO audit_logs (user_id, action, timestamp) VALUES (?, ?, ?)", [
    userId,
    action,
    new Date().toISOString(),
  ]);
};

module.exports = {
  requireAuth,
  requireRole,
  logAction,
};
