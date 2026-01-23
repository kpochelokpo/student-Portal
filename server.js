const path = require("path");
const express = require("express");
const session = require("express-session");

const authRoutes = require("./routes/auth");
const studentRoutes = require("./routes/student");
const teacherRoutes = require("./routes/teacher");
const adminRoutes = require("./routes/admin");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "has-hashs-portal-secret",
    resave: false,
    saveUninitialized: false,
  })
);

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user;
  next();
});

app.get("/", (req, res) => {
  res.redirect("/login");
});

app.use(authRoutes);
app.use("/student", studentRoutes);
app.use("/teacher", teacherRoutes);
app.use("/admin", adminRoutes);

app.use((req, res) => {
  res.status(404).render("auth/404");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
