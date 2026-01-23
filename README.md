# HALF ASSINI SENIOR HIGH SCHOOL - Student Results Portal

A complete Student Results Portal built with Node.js, Express, SQLite, and EJS for HALF ASSINI SENIOR HIGH SCHOOL.

## Features
- Role-based authentication for Admin, Teacher, and Student
- Published results view for students
- CSV template download and CSV upload for teachers
- Admin publishing, upload approvals, and audit logging
- Printable academic report card layout with watermark

## Setup
```bash
npm install
npm run db:setup
npm start
```

## Demo Credentials (Dummy Data)
- **Admin**
  - Username: `admin`
  - Password: `Admin123!`
- **Teacher**
  - Username: `tadams`
  - Staff ID: `T-1001`
  - Password: `Teach123!`
- **Student**
  - Index Number: `HASHS/001`
  - PIN: `1234`

## Notes
- Student results are visible only for published terms.
- Teachers can only upload results for their assigned subject and class.
- Admins approve uploads and control term publishing.
