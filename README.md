# High School Student Results Portal

**School:** HALF ASSINI SENIOR HIGH SCHOOL  
A secure, responsive Student Results Portal built with Node.js, Express, EJS, and SQLite. The UI follows the blue/yellow palette and uses the official school crest across the login, navigation bar, student dashboard, and report card.

## Features
- Student login (Index Number + PIN) and Admin login (Username + Password)
- Student dashboard with profile card, academic overview, and quick stats
- Results viewer with Academic Year, Term, and Class/Form filters
- PDF report card download (A4 portrait, official header, watermark)
- Admin dashboard for managing students, subjects, academic years, terms, and results
- Results entry (manual) + bulk CSV upload
- PIN reset for students
- Basic audit log

## Tech Stack
- Node.js + Express
- SQLite
- EJS templates
- Vanilla CSS + JavaScript
- bcrypt for password hashing
- Express sessions for authentication

## Setup Instructions
```bash
npm install
npm run db:init
npm start
```

Visit `http://localhost:3000` after the server starts.

## Demo Credentials
- **Admin**
  - Username: `admin`
  - Password: `Admin@123`
- **Student 1**
  - Index Number: `HASSH/001`
  - PIN: `2456`
- **Student 2**
  - Index Number: `HASSH/002`
  - PIN: `1357`

## Folder Structure
```
.
├── db
│   ├── db.js
│   └── schema.sql
├── middleware
│   └── auth.js
├── public
│   ├── css
│   │   └── styles.css
│   ├── docs
│   │   ├── clearance-form.pdf
│   │   └── student-handbook.pdf
│   ├── images
│   │   ├── school-crest.svg
│   │   ├── student-1.svg
│   │   └── student-2.svg
│   └── js
│       └── main.js
├── routes
│   ├── admin.js
│   ├── auth.js
│   ├── report.js
│   └── student.js
├── scripts
│   └── init-db.js
├── services
│   ├── audit.js
│   ├── grades.js
│   └── reportCard.js
├── views
│   ├── admin
│   │   ├── academic-years.ejs
│   │   ├── audit.ejs
│   │   ├── dashboard.ejs
│   │   ├── results.ejs
│   │   ├── students.ejs
│   │   ├── subjects.ejs
│   │   └── terms.ejs
│   ├── partials
│   │   ├── footer.ejs
│   │   ├── head.ejs
│   │   └── nav.ejs
│   ├── student
│   │   ├── dashboard.ejs
│   │   ├── report-preview.ejs
│   │   └── results.ejs
│   ├── forbidden.ejs
│   ├── login.ejs
│   └── not-found.ejs
├── package.json
├── server.js
└── README.md
```

## Database Schema Overview
- `users` (admin + student accounts)
- `students` (student profile data)
- `academic_years` (year names)
- `terms` (Term 1-3 with publish status)
- `subjects` (subject list)
- `results` (scores, grades, remarks)
- `audit_logs` (admin activity)

## CSV Upload Format
Use the following headers in your CSV upload:
```
index_no,term_id,subject_id,class_score,exam_score
```

## Notes
- Students can only view **published** terms.
- Scores are validated per the grading logic (0-50 each for class and exam scores).
- The report card PDF includes the school crest as a header icon and a faint watermark.
