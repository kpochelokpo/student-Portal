const express = require("express");
const multer = require("multer");
const { parse } = require("csv-parse/sync");
const bcrypt = require("bcryptjs");
const { all, get, run } = require("../db/db");
const { getGrade } = require("../utils/grading");
const { requireAuth, requireRole, logAction } = require("./middleware");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.use(requireAuth, requireRole("admin"));

router.get("/dashboard", async (req, res) => {
  const pendingUploads = await all(
    `SELECT result_uploads.*, subjects.name as subject, terms.name as term_name
     FROM result_uploads
     INNER JOIN subjects ON subjects.id = result_uploads.subject_id
     INNER JOIN terms ON terms.id = result_uploads.term_id
     WHERE result_uploads.status = 'pending'
     ORDER BY result_uploads.created_at DESC`
  );
  const counts = {
    students: await get("SELECT COUNT(*) as count FROM students"),
    teachers: await get("SELECT COUNT(*) as count FROM teachers"),
    subjects: await get("SELECT COUNT(*) as count FROM subjects"),
  };

  res.render("admin/dashboard", {
    pendingUploads,
    counts,
    message: req.query.message || null,
  });
});

router.get("/terms", async (req, res) => {
  const terms = await all(
    `SELECT terms.*, academic_years.name as academic_year
     FROM terms
     INNER JOIN academic_years ON academic_years.id = terms.academic_year_id`
  );
  res.render("admin/terms", { terms });
});

router.get("/bulk-upload", async (req, res) => {
  const subjects = await all("SELECT * FROM subjects ORDER BY name");
  const terms = await all(
    `SELECT terms.*, academic_years.name as academic_year_name
     FROM terms
     INNER JOIN academic_years ON academic_years.id = terms.academic_year_id`
  );
  res.render("admin/bulk-upload", {
    subjects,
    terms,
    message: req.query.message || null,
    error: req.query.error || null,
  });
});

router.post(
  "/bulk-upload",
  upload.single("results_file"),
  async (req, res) => {
    const { subject_id, term_id, class_name } = req.body;
    try {
      const fileContent = require("fs").readFileSync(req.file.path);
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      for (const record of records) {
        const student = await get(
          "SELECT id FROM students WHERE index_no = ? AND class_name = ?",
          [record.index_no, class_name]
        );
        if (!student) {
          continue;
        }
        const classScore = Number(record.class_score);
        const examScore = Number(record.exam_score);
        if (
          Number.isNaN(classScore) ||
          Number.isNaN(examScore) ||
          classScore < 0 ||
          examScore < 0 ||
          classScore > 100 ||
          examScore > 100
        ) {
          continue;
        }
        const total = classScore + examScore;
        if (total > 100) {
          continue;
        }
        const grade = getGrade(total);
        await run(
          "INSERT INTO results (student_id, term_id, subject_id, class_score, exam_score, total_score, grade, remark, status, uploaded_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?)",
          [
            student.id,
            term_id,
            subject_id,
            classScore,
            examScore,
            total,
            grade.grade,
            grade.remark,
            req.session.user.id,
            new Date().toISOString(),
          ]
        );
      }
      await logAction(req.session.user.id, "Bulk uploaded results");
      res.redirect("/admin/bulk-upload?message=Results uploaded.");
    } catch (err) {
      console.error(err);
      res.redirect("/admin/bulk-upload?error=Bulk upload failed.");
    }
  }
);

router.post("/terms/:id/publish", async (req, res) => {
  await run("UPDATE terms SET is_published = 1 WHERE id = ?", [req.params.id]);
  await logAction(req.session.user.id, "Published term results");
  res.redirect("/admin/terms");
});

router.post("/terms/:id/unpublish", async (req, res) => {
  await run("UPDATE terms SET is_published = 0 WHERE id = ?", [req.params.id]);
  await logAction(req.session.user.id, "Unpublished term results");
  res.redirect("/admin/terms");
});

router.get("/uploads", async (req, res) => {
  const uploads = await all(
    `SELECT result_uploads.*, subjects.name as subject, terms.name as term_name
     FROM result_uploads
     INNER JOIN subjects ON subjects.id = result_uploads.subject_id
     INNER JOIN terms ON terms.id = result_uploads.term_id
     ORDER BY result_uploads.created_at DESC`
  );
  res.render("admin/uploads", { uploads });
});

router.post("/uploads/:id/approve", async (req, res) => {
  const upload = await get("SELECT * FROM result_uploads WHERE id = ?", [
    req.params.id,
  ]);
  if (!upload) {
    res.redirect("/admin/uploads");
    return;
  }
  await run(
    "UPDATE results SET status = 'approved' WHERE term_id = ? AND subject_id = ? AND uploaded_by IN (SELECT user_id FROM teachers WHERE id = ?)",
    [upload.term_id, upload.subject_id, upload.teacher_id]
  );
  await run("UPDATE result_uploads SET status = 'approved' WHERE id = ?", [
    req.params.id,
  ]);
  await logAction(req.session.user.id, "Approved teacher upload");
  res.redirect("/admin/uploads");
});

router.post("/uploads/:id/reject", async (req, res) => {
  const reason = req.body.reason || "Rejected by admin";
  const upload = await get("SELECT * FROM result_uploads WHERE id = ?", [
    req.params.id,
  ]);
  if (!upload) {
    res.redirect("/admin/uploads");
    return;
  }
  await run(
    "DELETE FROM results WHERE term_id = ? AND subject_id = ? AND uploaded_by IN (SELECT user_id FROM teachers WHERE id = ?)",
    [upload.term_id, upload.subject_id, upload.teacher_id]
  );
  await run(
    "UPDATE result_uploads SET status = 'rejected', error_message = ? WHERE id = ?",
    [reason, req.params.id]
  );
  await logAction(req.session.user.id, "Rejected teacher upload");
  res.redirect("/admin/uploads");
});

router.get("/students", async (req, res) => {
  const students = await all("SELECT * FROM students ORDER BY surname");
  res.render("admin/students", { students, message: req.query.message || null });
});

router.get("/students/new", (req, res) => {
  res.render("admin/student-form", { student: null });
});

router.post("/students", async (req, res) => {
  const { index_no, surname, firstname, othernames, dob, class_name, programme } =
    req.body;
  const pinHash = await bcrypt.hash("1234", 10);
  await run(
    `INSERT INTO students (index_no, surname, firstname, othernames, dob, photo_url, class_name, programme, status, date_admitted, expected_graduation, scholarship, comments, pin_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      index_no,
      surname,
      firstname,
      othernames,
      dob,
      "/images/student1.svg",
      class_name,
      programme,
      "Active",
      new Date().toISOString().slice(0, 10),
      "2026-07-30",
      "None",
      "New student",
      pinHash,
    ]
  );
  await logAction(req.session.user.id, "Created student record");
  res.redirect("/admin/students?message=Student created.");
});

router.get("/students/:id/edit", async (req, res) => {
  const student = await get("SELECT * FROM students WHERE id = ?", [
    req.params.id,
  ]);
  res.render("admin/student-form", { student });
});

router.post("/students/:id", async (req, res) => {
  const { surname, firstname, othernames, dob, class_name, programme, status } =
    req.body;
  await run(
    `UPDATE students SET surname = ?, firstname = ?, othernames = ?, dob = ?, class_name = ?, programme = ?, status = ? WHERE id = ?`,
    [surname, firstname, othernames, dob, class_name, programme, status, req.params.id]
  );
  await logAction(req.session.user.id, "Updated student record");
  res.redirect("/admin/students?message=Student updated.");
});

router.post("/students/:id/delete", async (req, res) => {
  await run("DELETE FROM students WHERE id = ?", [req.params.id]);
  await logAction(req.session.user.id, "Deleted student record");
  res.redirect("/admin/students?message=Student deleted.");
});

router.post("/students/:id/reset-pin", async (req, res) => {
  const pinHash = await bcrypt.hash("1234", 10);
  await run("UPDATE students SET pin_hash = ? WHERE id = ?", [
    pinHash,
    req.params.id,
  ]);
  await logAction(req.session.user.id, "Reset student PIN");
  res.redirect("/admin/students?message=PIN reset to 1234.");
});

router.get("/teachers", async (req, res) => {
  const teachers = await all(
    `SELECT teachers.*, users.username FROM teachers
     INNER JOIN users ON users.id = teachers.user_id`
  );
  res.render("admin/teachers", {
    teachers,
    message: req.query.message || null,
  });
});

router.post("/teachers", async (req, res) => {
  const { staff_id, username, surname, firstname, othernames } = req.body;
  const passwordHash = await bcrypt.hash("Teach123!", 10);
  const user = await run(
    "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'teacher')",
    [username, passwordHash]
  );
  await run(
    "INSERT INTO teachers (user_id, staff_id, surname, firstname, othernames) VALUES (?, ?, ?, ?, ?)",
    [user.id, staff_id, surname, firstname, othernames]
  );
  await logAction(req.session.user.id, "Created teacher account");
  res.redirect("/admin/teachers?message=Teacher created.");
});

router.post("/teachers/:id/delete", async (req, res) => {
  const teacher = await get("SELECT * FROM teachers WHERE id = ?", [
    req.params.id,
  ]);
  if (teacher) {
    await run("DELETE FROM teachers WHERE id = ?", [teacher.id]);
    await run("DELETE FROM users WHERE id = ?", [teacher.user_id]);
  }
  await logAction(req.session.user.id, "Deleted teacher account");
  res.redirect("/admin/teachers?message=Teacher deleted.");
});

router.get("/assignments", async (req, res) => {
  const teachers = await all("SELECT * FROM teachers");
  const subjects = await all("SELECT * FROM subjects");
  const years = await all("SELECT * FROM academic_years");
  const assignments = await all(
    `SELECT teacher_assignments.*, subjects.name as subject, academic_years.name as academic_year,
      teachers.surname || ' ' || teachers.firstname as teacher_name
     FROM teacher_assignments
     INNER JOIN subjects ON subjects.id = teacher_assignments.subject_id
     INNER JOIN academic_years ON academic_years.id = teacher_assignments.academic_year_id
     INNER JOIN teachers ON teachers.id = teacher_assignments.teacher_id`
  );
  res.render("admin/assignments", { teachers, subjects, years, assignments });
});

router.post("/assignments", async (req, res) => {
  const { teacher_id, subject_id, class_name, academic_year_id } = req.body;
  await run(
    "INSERT INTO teacher_assignments (teacher_id, subject_id, class_name, academic_year_id) VALUES (?, ?, ?, ?)",
    [teacher_id, subject_id, class_name, academic_year_id]
  );
  await logAction(req.session.user.id, "Assigned teacher to class and subject");
  res.redirect("/admin/assignments");
});

router.post("/assignments/:id/delete", async (req, res) => {
  await run("DELETE FROM teacher_assignments WHERE id = ?", [req.params.id]);
  await logAction(req.session.user.id, "Removed teacher assignment");
  res.redirect("/admin/assignments");
});

router.get("/subjects", async (req, res) => {
  const subjects = await all("SELECT * FROM subjects ORDER BY name");
  res.render("admin/subjects", { subjects });
});

router.post("/subjects", async (req, res) => {
  await run("INSERT INTO subjects (name) VALUES (?)", [req.body.name]);
  await logAction(req.session.user.id, "Added subject");
  res.redirect("/admin/subjects");
});

router.post("/subjects/:id/delete", async (req, res) => {
  await run("DELETE FROM subjects WHERE id = ?", [req.params.id]);
  await logAction(req.session.user.id, "Deleted subject");
  res.redirect("/admin/subjects");
});

router.get("/academic-years", async (req, res) => {
  const years = await all("SELECT * FROM academic_years");
  res.render("admin/academic-years", { years });
});

router.post("/academic-years", async (req, res) => {
  await run("INSERT INTO academic_years (name) VALUES (?)", [req.body.name]);
  await logAction(req.session.user.id, "Added academic year");
  res.redirect("/admin/academic-years");
});

router.get("/audit-logs", async (req, res) => {
  const logs = await all(
    `SELECT audit_logs.*, users.username FROM audit_logs
     INNER JOIN users ON users.id = audit_logs.user_id
     ORDER BY audit_logs.timestamp DESC`
  );
  res.render("admin/audit-logs", { logs });
});

module.exports = router;
