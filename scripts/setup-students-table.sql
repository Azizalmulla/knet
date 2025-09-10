-- Create students table for CV submissions
CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  field_of_study VARCHAR(255),
  area_of_interest VARCHAR(255),
  cv_type VARCHAR(50) DEFAULT 'uploaded',
  cv_url TEXT,
  suggested_vacancies TEXT,
  suggested_vacancies_list JSONB,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_submitted_at ON students(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_students_field ON students(field_of_study);
CREATE INDEX IF NOT EXISTS idx_students_area ON students(area_of_interest);
