const express = require("express");
const multer = require("multer");
const { parse } = require("csv-parse/sync");
const { all, get, run } = require("../db/db");
const { getGrade } = require("../utils/grading");
const { requireAuth, requireRole, logAction } = require("./middleware");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.use(requireAuth, requireRole("teacher"));

const getTeacher = async (userId) =>
  get(
    `SELECT teachers.* FROM teachers
     INNER JOIN users ON users.id = teachers.user_id
     WHERE users.id = ?`,
    [userId]
  );

router.get("/dashboard", async (req, res) => {
  const teacher = await getTeacher(req.session.user.id);
  const assignments = await all(
    `SELECT teacher_assignments.*, subjects.name as subject, academic_years.name as academic_year
     FROM teacher_assignments
     INNER JOIN subjects ON subjects.id = teacher_assignments.subject_id
     INNER JOIN academic_years ON academic_years.id = teacher_assignments.academic_year_id
     WHERE teacher_assignments.teacher_id = ?`,
    [teacher.id]
  );
  const terms = await all(
    `SELECT terms.*, academic_years.name as academic_year_name
     FROM terms
     INNER JOIN academic_years ON academic_years.id = terms.academic_year_id`
  );
  const uploads = await all(
    `SELECT result_uploads.*, subjects.name as subject, terms.name as term_name
     FROM result_uploads
     INNER JOIN subjects ON subjects.id = result_uploads.subject_id
     INNER JOIN terms ON terms.id = result_uploads.term_id
     WHERE result_uploads.teacher_id = ?
     ORDER BY result_uploads.created_at DESC`,
    [teacher.id]
  );

  res.render("teacher/dashboard", {
    teacher,
    assignments,
    terms,
    uploads,
    message: req.query.message || null,
    error: req.query.error || null,
  });
});

router.get("/template", async (req, res) => {
  const assignmentId = req.query.assignment;
  const termId = req.query.term;

  const assignment = await get(
    `SELECT teacher_assignments.*, subjects.name as subject, academic_years.name as academic_year
     FROM teacher_assignments
     INNER JOIN subjects ON subjects.id = teacher_assignments.subject_id
     INNER JOIN academic_years ON academic_years.id = teacher_assignments.academic_year_id
     WHERE teacher_assignments.id = ?`,
    [assignmentId]
  );

  const term = await get(
    "SELECT * FROM terms WHERE id = ? AND academic_year_id = ?",
    [termId, assignment.academic_year_id]
  );

  const students = await all(
    "SELECT index_no FROM students WHERE class_name = ?",
    [assignment.class_name]
  );

  const rows = [
    [
      "academic_year",
      "term",
      "class_name",
      "subject",
      "index_no",
      "class_score",
      "exam_score",
    ].join(","),
  ];

  students.forEach((student) => {
    rows.push(
      [
        assignment.academic_year,
        term.name,
        assignment.class_name,
        assignment.subject,
        student.index_no,
        "",
        "",
      ].join(",")
    );
  });

  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${assignment.subject.replace(/\s+/g, "_")}_template.csv`
  );
  res.type("text/csv");
  res.send(rows.join("\n"));
});

router.post("/upload", upload.single("results_file"), async (req, res) => {
  const teacher = await getTeacher(req.session.user.id);
  const { assignment_id, term_id } = req.body;

  const assignment = await get(
    `SELECT teacher_assignments.*, subjects.name as subject
     FROM teacher_assignments
     INNER JOIN subjects ON subjects.id = teacher_assignments.subject_id
     WHERE teacher_assignments.id = ? AND teacher_assignments.teacher_id = ?`,
    [assignment_id, teacher.id]
  );

  if (!assignment) {
    res.redirect(
      "/teacher/dashboard?error=Invalid assignment selected."
    );
    return;
  }

  const term = await get(
    "SELECT * FROM terms WHERE id = ? AND academic_year_id = ?",
    [term_id, assignment.academic_year_id]
  );

  if (!term) {
    res.redirect("/teacher/dashboard?error=Invalid term selected.");
    return;
  }

  try {
    const fileContent = require("fs").readFileSync(req.file.path);
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const errors = [];
    for (const record of records) {
      if (!record.index_no) {
        errors.push("Missing index number.");
        break;
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
        errors.push(`Invalid scores for ${record.index_no}.`);
        break;
      }
    }

    if (errors.length > 0) {
      await run(
        "INSERT INTO result_uploads (teacher_id, term_id, subject_id, class_name, status, error_message, created_at) VALUES (?, ?, ?, ?, 'rejected', ?, ?)",
        [
          teacher.id,
          term.id,
          assignment.subject_id,
          assignment.class_name,
          errors.join(" "),
          new Date().toISOString(),
        ]
      );
      res.redirect(`/teacher/dashboard?error=${encodeURIComponent(errors[0])}`);
      return;
    }

    for (const record of records) {
      const student = await get(
        "SELECT id FROM students WHERE index_no = ? AND class_name = ?",
        [record.index_no, assignment.class_name]
      );
      if (!student) {
        continue;
      }
      const classScore = Number(record.class_score);
      const examScore = Number(record.exam_score);
      const total = classScore + examScore;
      if (total > 100) {
        continue;
      }
      const grade = getGrade(total);

      await run(
        "INSERT INTO results (student_id, term_id, subject_id, class_score, exam_score, total_score, grade, remark, status, uploaded_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)",
        [
          student.id,
          term.id,
          assignment.subject_id,
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

    await run(
      "INSERT INTO result_uploads (teacher_id, term_id, subject_id, class_name, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)",
      [
        teacher.id,
        term.id,
        assignment.subject_id,
        assignment.class_name,
        new Date().toISOString(),
      ]
    );

    await logAction(req.session.user.id, "Teacher uploaded results");

    res.redirect("/teacher/dashboard?message=Upload submitted for review.");
  } catch (err) {
    console.error(err);
    res.redirect("/teacher/dashboard?error=Upload failed. Please try again.");
  }
});

module.exports = router;
