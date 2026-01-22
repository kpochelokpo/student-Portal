const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { db, run, all } = require('../db/db');
const { evaluateGrade } = require('../services/grades');

const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');

const executeSchema = () =>
  new Promise((resolve, reject) => {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });

const seed = async () => {
  await run('DELETE FROM audit_logs');
  await run('DELETE FROM results');
  await run('DELETE FROM subjects');
  await run('DELETE FROM terms');
  await run('DELETE FROM academic_years');
  await run('DELETE FROM students');
  await run('DELETE FROM users');

  const adminPassword = await bcrypt.hash('Admin@123', 10);
  const studentPin1 = await bcrypt.hash('2456', 10);
  const studentPin2 = await bcrypt.hash('1357', 10);

  const admin = await run(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
    ['admin', adminPassword, 'admin']
  );

  const studentUser1 = await run(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
    ['HASSH/001', studentPin1, 'student']
  );

  const studentUser2 = await run(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
    ['HASSH/002', studentPin2, 'student']
  );

  const student1 = await run(
    `INSERT INTO students
      (index_no, surname, firstname, othernames, dob, photo_url, class_name, programme, status, date_admitted, expected_graduation, scholarship, comments, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    , [
      'HASSH/001',
      'MENSAH',
      'AMA',
      'ABENA',
      '2007-02-19',
      '/images/student-1.svg',
      'SHS 2A',
      'General Science',
      'In School',
      '2023-09-05',
      '2026-07-30',
      'Merit Scholarship',
      'Excellent academic standing.',
      studentUser1.id
    ]
  );

  const student2 = await run(
    `INSERT INTO students
      (index_no, surname, firstname, othernames, dob, photo_url, class_name, programme, status, date_admitted, expected_graduation, scholarship, comments, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    , [
      'HASSH/002',
      'KWAKU',
      'NANA',
      'YOUSIF',
      '2006-11-03',
      '/images/student-2.svg',
      'SHS 3B',
      'Business',
      'In School',
      '2022-09-08',
      '2025-07-30',
      'Needs-Based Scholarship',
      'Leadership in student council.',
      studentUser2.id
    ]
  );

  const year = await run('INSERT INTO academic_years (name) VALUES (?)', ['2024/2025']);

  const term1 = await run(
    'INSERT INTO terms (academic_year_id, name, start_date, end_date, is_published) VALUES (?, ?, ?, ?, ?)',
    [year.id, 'Term 1', '2024-09-10', '2024-12-12', 1]
  );
  const term2 = await run(
    'INSERT INTO terms (academic_year_id, name, start_date, end_date, is_published) VALUES (?, ?, ?, ?, ?)',
    [year.id, 'Term 2', '2025-01-15', '2025-04-12', 1]
  );
  const term3 = await run(
    'INSERT INTO terms (academic_year_id, name, start_date, end_date, is_published) VALUES (?, ?, ?, ?, ?)',
    [year.id, 'Term 3', '2025-05-10', '2025-07-30', 0]
  );

  const subjects = [
    'Mathematics',
    'English Language',
    'Integrated Science',
    'Social Studies',
    'Physics',
    'Chemistry',
    'Biology',
    'Economics',
    'Business Management'
  ];

  const subjectIds = [];
  for (const subject of subjects) {
    const entry = await run('INSERT INTO subjects (name) VALUES (?)', [subject]);
    subjectIds.push(entry.id);
  }

  const resultSeed = [
    { studentId: student1.id, termId: term1.id, subjectId: subjectIds[0], classScore: 40, examScore: 45 },
    { studentId: student1.id, termId: term1.id, subjectId: subjectIds[1], classScore: 38, examScore: 39 },
    { studentId: student1.id, termId: term1.id, subjectId: subjectIds[2], classScore: 36, examScore: 41 },
    { studentId: student1.id, termId: term1.id, subjectId: subjectIds[3], classScore: 42, examScore: 40 },
    { studentId: student1.id, termId: term2.id, subjectId: subjectIds[0], classScore: 44, examScore: 44 },
    { studentId: student1.id, termId: term2.id, subjectId: subjectIds[1], classScore: 35, examScore: 36 },
    { studentId: student1.id, termId: term2.id, subjectId: subjectIds[2], classScore: 40, examScore: 43 },
    { studentId: student1.id, termId: term2.id, subjectId: subjectIds[3], classScore: 41, examScore: 40 },
    { studentId: student2.id, termId: term1.id, subjectId: subjectIds[4], classScore: 32, examScore: 36 },
    { studentId: student2.id, termId: term1.id, subjectId: subjectIds[5], classScore: 37, examScore: 38 },
    { studentId: student2.id, termId: term1.id, subjectId: subjectIds[6], classScore: 40, examScore: 39 },
    { studentId: student2.id, termId: term2.id, subjectId: subjectIds[7], classScore: 42, examScore: 43 },
    { studentId: student2.id, termId: term2.id, subjectId: subjectIds[8], classScore: 38, examScore: 40 }
  ];

  for (const result of resultSeed) {
    const grade = evaluateGrade(result.classScore, result.examScore);
    await run(
      `INSERT INTO results
        (student_id, term_id, subject_id, class_score, exam_score, total_score, grade, remark, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        result.studentId,
        result.termId,
        result.subjectId,
        result.classScore,
        result.examScore,
        grade.total,
        grade.grade,
        grade.remark,
        admin.id
      ]
    );
  }

  await run(
    'INSERT INTO audit_logs (actor_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)',
    [admin.id, 'Seeded initial dataset', 'system', 1]
  );

  const counts = {
    users: await all('SELECT COUNT(*) as count FROM users'),
    students: await all('SELECT COUNT(*) as count FROM students'),
    results: await all('SELECT COUNT(*) as count FROM results')
  };

  console.log('Seed complete:', counts);
};

executeSchema()
  .then(seed)
  .then(() => {
    console.log('Database initialized.');
    db.close();
  })
  .catch((err) => {
    console.error('Database initialization failed:', err);
    db.close();
    process.exit(1);
  });
