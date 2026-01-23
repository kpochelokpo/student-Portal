CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'teacher', 'student'))
);

CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  staff_id TEXT UNIQUE NOT NULL,
  surname TEXT NOT NULL,
  firstname TEXT NOT NULL,
  othernames TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS teacher_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  class_name TEXT NOT NULL,
  academic_year_id INTEGER NOT NULL,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  index_no TEXT UNIQUE NOT NULL,
  surname TEXT NOT NULL,
  firstname TEXT NOT NULL,
  othernames TEXT,
  dob TEXT NOT NULL,
  photo_url TEXT,
  class_name TEXT NOT NULL,
  programme TEXT NOT NULL,
  status TEXT NOT NULL,
  date_admitted TEXT NOT NULL,
  expected_graduation TEXT NOT NULL,
  scholarship TEXT,
  comments TEXT,
  pin_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS academic_years (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academic_year_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_published INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
);

CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  term_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  class_score INTEGER NOT NULL,
  exam_score INTEGER NOT NULL,
  total_score INTEGER NOT NULL,
  grade TEXT NOT NULL,
  remark TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'approved')),
  uploaded_by INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (term_id) REFERENCES terms(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS result_uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL,
  term_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  class_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')),
  error_message TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id),
  FOREIGN KEY (term_id) REFERENCES terms(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
