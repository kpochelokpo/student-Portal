const express = require("express");
const path = require("path");
const { all, get } = require("../db/db");
const { requireAuth, requireRole } = require("./middleware");

const router = express.Router();

router.use(requireAuth, requireRole("student"));

router.get("/dashboard", async (req, res) => {
  const student = await get("SELECT * FROM students WHERE id = ?", [
    req.session.user.id,
  ]);
  const averageRow = await get(
    `SELECT AVG(total_score) as average
     FROM results
     INNER JOIN terms ON terms.id = results.term_id
     WHERE results.student_id = ? AND results.status = 'approved' AND terms.is_published = 1`,
    [student.id]
  );
  res.render("student/dashboard", {
    student,
    overallAverage: averageRow?.average ? averageRow.average.toFixed(1) : "0.0",
  });
});

router.get("/results", async (req, res) => {
  const student = await get("SELECT * FROM students WHERE id = ?", [
    req.session.user.id,
  ]);
  const academicYears = await all("SELECT * FROM academic_years");
  const terms = await all(
    "SELECT terms.*, academic_years.name as academic_year_name FROM terms INNER JOIN academic_years ON academic_years.id = terms.academic_year_id"
  );

  const selectedYear = req.query.year || academicYears[0]?.id;
  const selectedTerm = req.query.term || null;

  const results = await all(
    `SELECT subjects.name as subject, results.class_score, results.exam_score, results.total_score, results.grade, results.remark,
     terms.end_date as term_end, terms.name as term_name, academic_years.name as academic_year_name
     FROM results
     INNER JOIN subjects ON subjects.id = results.subject_id
     INNER JOIN terms ON terms.id = results.term_id
     INNER JOIN academic_years ON academic_years.id = terms.academic_year_id
     WHERE results.student_id = ? AND results.status = 'approved' AND terms.is_published = 1
     ${selectedYear ? "AND academic_years.id = ?" : ""}
     ${selectedTerm ? "AND terms.id = ?" : ""}
     ORDER BY terms.id DESC`,
    selectedYear && selectedTerm
      ? [student.id, selectedYear, selectedTerm]
      : selectedYear
      ? [student.id, selectedYear]
      : [student.id]
  );

  const termEnd = results[0]?.term_end || null;

  res.render("student/results", {
    student,
    academicYears,
    terms,
    results,
    selectedYear,
    selectedTerm,
    termEnd,
  });
});

router.get("/report", async (req, res) => {
  const student = await get("SELECT * FROM students WHERE id = ?", [
    req.session.user.id,
  ]);
  const termId = req.query.term;
  const term = await get(
    `SELECT terms.*, academic_years.name as academic_year_name
     FROM terms INNER JOIN academic_years ON academic_years.id = terms.academic_year_id
     WHERE terms.id = ?`,
    [termId]
  );
  if (!term || !term.is_published) {
    res.status(403).render("auth/403");
    return;
  }

  const results = await all(
    `SELECT subjects.name as subject, results.class_score, results.exam_score, results.total_score, results.grade, results.remark
     FROM results
     INNER JOIN subjects ON subjects.id = results.subject_id
     WHERE results.student_id = ? AND results.term_id = ? AND results.status = 'approved'`,
    [student.id, termId]
  );

  res.render("student/report", {
    student,
    term,
    results,
  });
});

router.get("/download/:doc", (req, res) => {
  const fileMap = {
    handbook: "student-handbook.pdf",
    clearance: "clearance-form.pdf",
  };
  const file = fileMap[req.params.doc];
  if (!file) {
    res.status(404).render("auth/404");
    return;
  }
  res.download(path.join(__dirname, "../public/docs", file));
});

module.exports = router;
