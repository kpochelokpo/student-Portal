const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { db, run, get, all } = require("./db");

const schemaPath = path.join(__dirname, "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf-8");

const seedDatabase = async () => {
  const userCount = await get("SELECT COUNT(*) as count FROM users");
  if (userCount && userCount.count > 0) {
    console.log("Database already seeded.");
    return;
  }

  const adminPassword = await bcrypt.hash("Admin123!", 10);
  const teacherPassword = await bcrypt.hash("Teach123!", 10);
  const studentPin = await bcrypt.hash("1234", 10);

  const adminUser = await run(
    "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')",
    ["admin", adminPassword]
  );
  const teacherUser = await run(
    "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'teacher')",
    ["tadams", teacherPassword]
  );

  const teacher = await run(
    "INSERT INTO teachers (user_id, staff_id, surname, firstname, othernames) VALUES (?, ?, ?, ?, ?)",
    [teacherUser.id, "T-1001", "Adams", "Theresa", "Efua"]
  );

  await run(
    "INSERT INTO students (index_no, surname, firstname, othernames, dob, photo_url, class_name, programme, status, date_admitted, expected_graduation, scholarship, comments, pin_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      "HASHS/001",
      "Mensah",
      "Kojo",
      "Yaw",
      "2007-03-12",
      "/images/student1.svg",
      "SHS 2A",
      "General Science",
      "Active",
      "2022-09-12",
      "2025-07-30",
      "Merit",
      "Consistent performer",
      studentPin,
    ]
  );
  await run(
    "INSERT INTO students (index_no, surname, firstname, othernames, dob, photo_url, class_name, programme, status, date_admitted, expected_graduation, scholarship, comments, pin_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      "HASHS/002",
      "Boateng",
      "Ama",
      "Serwaa",
      "2006-11-05",
      "/images/student2.svg",
      "SHS 2A",
      "General Science",
      "Active",
      "2022-09-12",
      "2025-07-30",
      "None",
      "Excellent attendance",
      studentPin,
    ]
  );

  const academicYear = await run(
    "INSERT INTO academic_years (name) VALUES (?)",
    ["2024/2025"]
  );

  const termOne = await run(
    "INSERT INTO terms (academic_year_id, name, start_date, end_date, is_published) VALUES (?, ?, ?, ?, 1)",
    [academicYear.id, "Term 1", "2024-09-01", "2024-12-15"]
  );
  const termTwo = await run(
    "INSERT INTO terms (academic_year_id, name, start_date, end_date, is_published) VALUES (?, ?, ?, ?, 1)",
    [academicYear.id, "Term 2", "2025-01-10", "2025-04-05"]
  );
  await run(
    "INSERT INTO terms (academic_year_id, name, start_date, end_date, is_published) VALUES (?, ?, ?, ?, 0)",
    [academicYear.id, "Term 3", "2025-05-01", "2025-07-30"]
  );

  const subjects = [
    "Core Mathematics",
    "English Language",
    "Integrated Science",
    "Social Studies",
    "Physics",
    "Chemistry",
    "Biology",
    "Elective Mathematics",
  ];

  const subjectIds = [];
  for (const subject of subjects) {
    const subjectRow = await run(
      "INSERT INTO subjects (name) VALUES (?)",
      [subject]
    );
    subjectIds.push(subjectRow.id);
  }

  await run(
    "INSERT INTO teacher_assignments (teacher_id, subject_id, class_name, academic_year_id) VALUES (?, ?, ?, ?)",
    [teacher.id, subjectIds[0], "SHS 2A", academicYear.id]
  );

  const students = await all("SELECT id FROM students");
  const results = [
    { classScore: 35, examScore: 55 },
    { classScore: 32, examScore: 50 },
  ];

  const { getGrade } = require("../utils/grading");
  for (let i = 0; i < students.length; i += 1) {
    const total = results[i].classScore + results[i].examScore;
    const grade = getGrade(total);
    await run(
      "INSERT INTO results (student_id, term_id, subject_id, class_score, exam_score, total_score, grade, remark, status, uploaded_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?)",
      [
        students[i].id,
        termOne.id,
        subjectIds[0],
        results[i].classScore,
        results[i].examScore,
        total,
        grade.grade,
        grade.remark,
        adminUser.id,
        new Date().toISOString(),
      ]
    );
  }

  for (let i = 0; i < students.length; i += 1) {
    const total = 70 + i * 5;
    const grade = getGrade(total);
    await run(
      "INSERT INTO results (student_id, term_id, subject_id, class_score, exam_score, total_score, grade, remark, status, uploaded_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?)",
      [
        students[i].id,
        termTwo.id,
        subjectIds[1],
        30,
        total - 30,
        total,
        grade.grade,
        grade.remark,
        adminUser.id,
        new Date().toISOString(),
      ]
    );
  }

  await run(
    "INSERT INTO audit_logs (user_id, action, timestamp) VALUES (?, ?, ?)",
    [adminUser.id, "Seeded initial database", new Date().toISOString()]
  );

  console.log("Database seeded successfully.");
};

const init = async () => {
  await run("PRAGMA foreign_keys = ON");
  await new Promise((resolve, reject) => {
    db.exec(schema, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
  await seedDatabase();
  db.close();
};

init().catch((err) => {
  console.error(err);
  db.close();
});
