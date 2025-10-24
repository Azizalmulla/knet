-- Remove contact_email column (keeping it simple - use login email for everything)

ALTER TABLE admin_users 
  DROP COLUMN IF EXISTS contact_email;

-- Remove the index too
DROP INDEX IF EXISTS idx_admin_users_contact_email;

-- Comment: Admin login email is their real email address for receiving replies
COMMENT ON COLUMN admin_users.email IS 'Admin email address - used for login AND receiving candidate replies (must be a real mailbox)';
