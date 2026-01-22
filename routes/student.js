const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { get, all } = require('../db/db');

const router = express.Router();

const getStudentByUser = async (userId) =>
  get('SELECT * FROM students WHERE user_id = ?', [userId]);

router.get('/dashboard', requireAuth('student'), async (req, res) => {
  try {
    const student = await getStudentByUser(req.session.user.id);
    if (!student) {
      return res.status(404).render('not-found');
    }

    const averages = await get(
      `SELECT AVG(total_score) as overall_average
       FROM results
       WHERE student_id = ?`,
      [student.id]
    );

    res.render('student/dashboard', {
      student,
      overallAverage: averages?.overall_average ? Number(averages.overall_average).toFixed(1) : 'N/A'
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('student/dashboard', { student: null, overallAverage: 'N/A' });
  }
});

router.get('/results', requireAuth('student'), async (req, res) => {
  try {
    const student = await getStudentByUser(req.session.user.id);
    if (!student) {
      return res.status(404).render('not-found');
    }

    const academicYears = await all('SELECT * FROM academic_years ORDER BY name DESC');
    const selectedYear = req.query.academic_year || (academicYears[0]?.id?.toString() || '');

    const terms = await all(
      `SELECT terms.*, academic_years.name as academic_year
       FROM terms
       JOIN academic_years ON academic_years.id = terms.academic_year_id
       WHERE terms.is_published = 1 AND academic_years.id = ?
       ORDER BY terms.start_date DESC`,
      [selectedYear]
    );

    const selectedTerm = req.query.term || (terms[0]?.id?.toString() || '');

    const term = selectedTerm
      ? await get(
          `SELECT terms.*, academic_years.name as academic_year
           FROM terms
           JOIN academic_years ON academic_years.id = terms.academic_year_id
           WHERE terms.id = ? AND terms.is_published = 1`,
          [selectedTerm]
        )
      : null;

    const results = selectedTerm
      ? await all(
          `SELECT subjects.name as subject, results.class_score, results.exam_score, results.total_score, results.grade, results.remark
           FROM results
           JOIN subjects ON subjects.id = results.subject_id
           WHERE results.student_id = ? AND results.term_id = ?
           ORDER BY subjects.name`,
          [student.id, selectedTerm]
        )
      : [];

    res.render('student/results', {
      student,
      academicYears,
      terms,
      results,
      selectedYear,
      selectedTerm,
      term
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('student/results', { student: null, academicYears: [], terms: [], results: [], selectedYear: '', selectedTerm: '', term: null });
  }
});

router.get('/report-card', requireAuth('student'), async (req, res) => {
  try {
    const student = await getStudentByUser(req.session.user.id);
    if (!student) {
      return res.status(404).render('not-found');
    }

    const terms = await all(
      `SELECT terms.*, academic_years.name as academic_year
       FROM terms
       JOIN academic_years ON academic_years.id = terms.academic_year_id
       WHERE terms.is_published = 1
       ORDER BY terms.start_date`
    );

    res.render('student/report-preview', { student, terms });
  } catch (error) {
    console.error(error);
    res.status(500).render('not-found');
  }
});

module.exports = router;
