-- Seed a default Super Admin user (idempotent)
-- Password hash corresponds to: super123
INSERT INTO super_admins (email, password_hash, name)
VALUES (
  'super@careerly.com',
  '$2a$12$LQQKJPbqPGWKkYwNRWHRa.Jb1aJKW.AEd5H5jrZ5L9QKrHgGYLGdO',
  'Super Admin'
)
ON CONFLICT (email) DO NOTHING;
