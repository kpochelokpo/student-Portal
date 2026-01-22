const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { get, all } = require('../db/db');
const { generateReportCard } = require('../services/reportCard');

const router = express.Router();

const loadStudentByUser = async (userId) =>
  get('SELECT * FROM students WHERE user_id = ?', [userId]);

router.get('/student/report-card', requireAuth('student'), async (req, res) => {
  try {
    const student = await loadStudentByUser(req.session.user.id);
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

    const resultsByTerm = {};
    for (const term of terms) {
      const results = await all(
        `SELECT subjects.name as subject, results.class_score, results.exam_score, results.total_score, results.grade, results.remark
         FROM results
         JOIN subjects ON subjects.id = results.subject_id
         WHERE results.student_id = ? AND results.term_id = ?
         ORDER BY subjects.name`,
        [student.id, term.id]
      );
      resultsByTerm[term.id] = results;
    }

    return generateReportCard({ student, terms, resultsByTerm }, res);
  } catch (error) {
    console.error(error);
    return res.status(500).render('not-found');
  }
});

module.exports = router;
