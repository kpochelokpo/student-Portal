const express = require('express');
const bcrypt = require('bcrypt');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { requireAuth } = require('../middleware/auth');
const { get, all, run } = require('../db/db');
const { evaluateGrade } = require('../services/grades');
const { logAudit } = require('../services/audit');

const router = express.Router();
const upload = multer();

router.use(requireAuth('admin'));

router.get('/dashboard', async (req, res) => {
  const [students, subjects, terms, results] = await Promise.all([
    get('SELECT COUNT(*) as count FROM students'),
    get('SELECT COUNT(*) as count FROM subjects'),
    get('SELECT COUNT(*) as count FROM terms'),
    get('SELECT COUNT(*) as count FROM results')
  ]);

  res.render('admin/dashboard', { stats: { students, subjects, terms, results } });
});

router.get('/students', async (req, res) => {
  const students = await all('SELECT * FROM students ORDER BY surname');
  res.render('admin/students', { students, error: null });
});

router.post('/students', async (req, res) => {
  try {
    const {
      index_no,
      surname,
      firstname,
      othernames,
      dob,
      photo_url,
      class_name,
      programme,
      status,
      date_admitted,
      expected_graduation,
      scholarship,
      comments
    } = req.body;

    const pin = (req.body.pin || '').trim();
    if (!index_no || !surname || !firstname || !pin) {
      const students = await all('SELECT * FROM students ORDER BY surname');
      return res.status(400).render('admin/students', {
        students,
        error: 'Index number, names, and PIN are required.'
      });
    }

    const passwordHash = await bcrypt.hash(pin, 10);
    const user = await run(
      'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
      [index_no, passwordHash, 'student']
    );

    const student = await run(
      `INSERT INTO students
       (index_no, surname, firstname, othernames, dob, photo_url, class_name, programme, status, date_admitted, expected_graduation, scholarship, comments, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        index_no,
        surname,
        firstname,
        othernames,
        dob,
        photo_url,
        class_name,
        programme,
        status,
        date_admitted,
        expected_graduation,
        scholarship,
        comments,
        user.id
      ]
    );

    await logAudit(req.session.user.id, 'Created student profile', 'student', student.id);
    return res.redirect('/admin/students');
  } catch (error) {
    console.error(error);
    const students = await all('SELECT * FROM students ORDER BY surname');
    return res.status(500).render('admin/students', {
      students,
      error: 'Unable to create student.'
    });
  }
});

router.post('/students/:id/delete', async (req, res) => {
  const student = await get('SELECT * FROM students WHERE id = ?', [req.params.id]);
  if (student) {
    await run('DELETE FROM students WHERE id = ?', [req.params.id]);
    await run('DELETE FROM users WHERE id = ?', [student.user_id]);
    await logAudit(req.session.user.id, 'Deleted student profile', 'student', student.id);
  }
  res.redirect('/admin/students');
});

router.post('/students/:id/reset-pin', async (req, res) => {
  const student = await get('SELECT * FROM students WHERE id = ?', [req.params.id]);
  if (!student || !student.user_id) {
    return res.redirect('/admin/students');
  }

  const newPin = req.body.new_pin?.trim();
  if (!newPin) {
    return res.redirect('/admin/students');
  }

  const passwordHash = await bcrypt.hash(newPin, 10);
  await run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, student.user_id]);
  await logAudit(req.session.user.id, 'Reset student PIN', 'student', student.id);
  return res.redirect('/admin/students');
});

router.get('/subjects', async (req, res) => {
  const subjects = await all('SELECT * FROM subjects ORDER BY name');
  res.render('admin/subjects', { subjects });
});

router.post('/subjects', async (req, res) => {
  if (req.body.name) {
    await run('INSERT INTO subjects (name) VALUES (?)', [req.body.name]);
    await logAudit(req.session.user.id, 'Added subject', 'subject', 0);
  }
  res.redirect('/admin/subjects');
});

router.post('/subjects/:id/delete', async (req, res) => {
  await run('DELETE FROM subjects WHERE id = ?', [req.params.id]);
  await logAudit(req.session.user.id, 'Deleted subject', 'subject', Number(req.params.id));
  res.redirect('/admin/subjects');
});

router.get('/academic-years', async (req, res) => {
  const years = await all('SELECT * FROM academic_years ORDER BY name DESC');
  res.render('admin/academic-years', { years });
});

router.post('/academic-years', async (req, res) => {
  if (req.body.name) {
    await run('INSERT INTO academic_years (name) VALUES (?)', [req.body.name]);
    await logAudit(req.session.user.id, 'Added academic year', 'academic_year', 0);
  }
  res.redirect('/admin/academic-years');
});

router.post('/academic-years/:id/delete', async (req, res) => {
  await run('DELETE FROM academic_years WHERE id = ?', [req.params.id]);
  await logAudit(req.session.user.id, 'Deleted academic year', 'academic_year', Number(req.params.id));
  res.redirect('/admin/academic-years');
});

router.get('/terms', async (req, res) => {
  const years = await all('SELECT * FROM academic_years ORDER BY name DESC');
  const terms = await all(
    `SELECT terms.*, academic_years.name as academic_year
     FROM terms
     JOIN academic_years ON academic_years.id = terms.academic_year_id
     ORDER BY terms.start_date DESC`
  );
  res.render('admin/terms', { terms, years });
});

router.post('/terms', async (req, res) => {
  const { academic_year_id, name, start_date, end_date } = req.body;
  if (academic_year_id && name) {
    await run(
      'INSERT INTO terms (academic_year_id, name, start_date, end_date, is_published) VALUES (?, ?, ?, ?, ?)',
      [academic_year_id, name, start_date, end_date, 0]
    );
    await logAudit(req.session.user.id, 'Added term', 'term', 0);
  }
  res.redirect('/admin/terms');
});

router.post('/terms/:id/toggle', async (req, res) => {
  const term = await get('SELECT * FROM terms WHERE id = ?', [req.params.id]);
  if (term) {
    const newStatus = term.is_published ? 0 : 1;
    await run('UPDATE terms SET is_published = ? WHERE id = ?', [newStatus, term.id]);
    await logAudit(req.session.user.id, 'Updated term publish status', 'term', term.id);
  }
  res.redirect('/admin/terms');
});

router.get('/results', async (req, res) => {
  const students = await all('SELECT id, index_no, surname, firstname FROM students ORDER BY surname');
  const terms = await all('SELECT id, name FROM terms ORDER BY start_date DESC');
  const subjects = await all('SELECT id, name FROM subjects ORDER BY name');
  const results = await all(
    `SELECT results.*, students.index_no, subjects.name as subject, terms.name as term
     FROM results
     JOIN students ON students.id = results.student_id
     JOIN subjects ON subjects.id = results.subject_id
     JOIN terms ON terms.id = results.term_id
     ORDER BY results.updated_at DESC
     LIMIT 50`
  );
  res.render('admin/results', { students, terms, subjects, results, error: null });
});

router.post('/results', async (req, res) => {
  const students = await all('SELECT id, index_no, surname, firstname FROM students ORDER BY surname');
  const terms = await all('SELECT id, name FROM terms ORDER BY start_date DESC');
  const subjects = await all('SELECT id, name FROM subjects ORDER BY name');

  try {
    const { student_id, term_id, subject_id, class_score, exam_score } = req.body;
    const grade = evaluateGrade(Number(class_score), Number(exam_score));
    await run(
      `INSERT INTO results
       (student_id, term_id, subject_id, class_score, exam_score, total_score, grade, remark, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        student_id,
        term_id,
        subject_id,
        class_score,
        exam_score,
        grade.total,
        grade.grade,
        grade.remark,
        req.session.user.id
      ]
    );

    await logAudit(req.session.user.id, 'Added result entry', 'result', 0);
    return res.redirect('/admin/results');
  } catch (error) {
    console.error(error);
    const results = await all(
      `SELECT results.*, students.index_no, subjects.name as subject, terms.name as term
       FROM results
       JOIN students ON students.id = results.student_id
       JOIN subjects ON subjects.id = results.subject_id
       JOIN terms ON terms.id = results.term_id
       ORDER BY results.updated_at DESC
       LIMIT 50`
    );
    return res.status(400).render('admin/results', {
      students,
      terms,
      subjects,
      results,
      error: error.message
    });
  }
});

router.post('/results/upload', upload.single('csv_file'), async (req, res) => {
  if (!req.file) {
    return res.redirect('/admin/results');
  }

  try {
    const records = parse(req.file.buffer.toString('utf8'), {
      columns: true,
      skip_empty_lines: true
    });

    for (const record of records) {
      const student = await get('SELECT id FROM students WHERE index_no = ?', [record.index_no]);
      if (!student) {
        continue;
      }
      const grade = evaluateGrade(Number(record.class_score), Number(record.exam_score));
      await run(
        `INSERT INTO results
         (student_id, term_id, subject_id, class_score, exam_score, total_score, grade, remark, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          student.id,
          record.term_id,
          record.subject_id,
          record.class_score,
          record.exam_score,
          grade.total,
          grade.grade,
          grade.remark,
          req.session.user.id
        ]
      );
    }

    await logAudit(req.session.user.id, 'Bulk uploaded results', 'result', 0);
    return res.redirect('/admin/results');
  } catch (error) {
    console.error(error);
    return res.redirect('/admin/results');
  }
});

router.get('/audit', async (req, res) => {
  const logs = await all(
    `SELECT audit_logs.*, users.username as actor
     FROM audit_logs
     LEFT JOIN users ON users.id = audit_logs.actor_id
     ORDER BY audit_logs.created_at DESC
     LIMIT 100`
  );
  res.render('admin/audit', { logs });
});

module.exports = router;
