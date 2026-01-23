const express = require("express");
const bcrypt = require("bcryptjs");
const { get } = require("../db/db");

const router = express.Router();

router.get("/login", (req, res) => {
  res.render("auth/login", { error: null });
});

router.post("/login", async (req, res) => {
  const { role, identifier, password, pin } = req.body;
  try {
    if (role === "student") {
      const student = await get(
        "SELECT * FROM students WHERE index_no = ?",
        [identifier]
      );
      if (!student) {
        res.render("auth/login", { error: "Invalid student credentials." });
        return;
      }
      const isMatch = await bcrypt.compare(pin, student.pin_hash);
      if (!isMatch) {
        res.render("auth/login", { error: "Invalid student credentials." });
        return;
      }
      req.session.user = {
        id: student.id,
        role: "student",
        name: `${student.firstname} ${student.surname}`,
      };
      res.redirect("/student/dashboard");
      return;
    }

    if (role === "teacher") {
      const user = await get(
        `SELECT users.*, teachers.staff_id FROM users
         LEFT JOIN teachers ON teachers.user_id = users.id
         WHERE users.role = 'teacher' AND (users.username = ? OR teachers.staff_id = ?)` ,
        [identifier, identifier]
      );
      if (!user) {
        res.render("auth/login", { error: "Invalid teacher credentials." });
        return;
      }
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        res.render("auth/login", { error: "Invalid teacher credentials." });
        return;
      }
      req.session.user = {
        id: user.id,
        role: "teacher",
        name: user.username,
      };
      res.redirect("/teacher/dashboard");
      return;
    }

    const admin = await get(
      "SELECT * FROM users WHERE role = 'admin' AND username = ?",
      [identifier]
    );
    if (!admin) {
      res.render("auth/login", { error: "Invalid admin credentials." });
      return;
    }
    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      res.render("auth/login", { error: "Invalid admin credentials." });
      return;
    }
    req.session.user = {
      id: admin.id,
      role: "admin",
      name: admin.username,
    };
    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error(err);
    res.render("auth/login", { error: "Login failed. Please try again." });
  }
});

router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

module.exports = router;
