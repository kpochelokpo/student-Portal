const express = require('express');
const bcrypt = require('bcrypt');
const { get } = require('../db/db');

const router = express.Router();

router.get('/', (req, res) => {
  res.redirect('/login');
});

router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

router.post('/login/student', async (req, res) => {
  try {
    const { indexNo, pin } = req.body;
    if (!indexNo || !pin) {
      return res.status(400).render('login', { error: 'Enter your index number and PIN.' });
    }

    const studentUser = await get('SELECT * FROM users WHERE username = ? AND role = ?', [indexNo, 'student']);
    if (!studentUser) {
      return res.status(401).render('login', { error: 'Invalid student credentials.' });
    }

    const match = await bcrypt.compare(pin, studentUser.password_hash);
    if (!match) {
      return res.status(401).render('login', { error: 'Invalid student credentials.' });
    }

    req.session.user = {
      id: studentUser.id,
      role: 'student',
      username: studentUser.username
    };

    return res.redirect('/student/dashboard');
  } catch (error) {
    console.error(error);
    return res.status(500).render('login', { error: 'Unable to log in right now.' });
  }
});

router.post('/login/admin', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).render('login', { error: 'Enter admin username and password.' });
    }

    const adminUser = await get('SELECT * FROM users WHERE username = ? AND role = ?', [username, 'admin']);
    if (!adminUser) {
      return res.status(401).render('login', { error: 'Invalid admin credentials.' });
    }

    const match = await bcrypt.compare(password, adminUser.password_hash);
    if (!match) {
      return res.status(401).render('login', { error: 'Invalid admin credentials.' });
    }

    req.session.user = {
      id: adminUser.id,
      role: 'admin',
      username: adminUser.username
    };

    return res.redirect('/admin/dashboard');
  } catch (error) {
    console.error(error);
    return res.status(500).render('login', { error: 'Unable to log in right now.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
