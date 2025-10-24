# Admin Email Setup - Simple Approach ✅

## How It Works:

**One email for everything:**
- Login email = Real mailbox
- Replies go to the same email
- Simple and professional

---

## Setup:

### **Admin Email Requirements:**

✅ **Must be a real mailbox** (Gmail, Outlook, company email, etc.)  
✅ **Admin must have access to check it**  
✅ **Professional company domain preferred** (`sarah@company.com` > `sarah@gmail.com`)  

---

## Database Schema:

```sql
CREATE TABLE admin_users (
  id UUID PRIMARY KEY,
  org_id UUID REFERENCES organizations(id),
  email VARCHAR(255) NOT NULL,  -- Real email for login AND replies
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Email is used for:
-- 1. Login authentication
-- 2. Reply-To address in candidate emails
-- 3. Receiving candidate replies
-- 4. (Future) Inbox message routing
```

---

## Email Flow:

### **1. Admin Account:**
```sql
INSERT INTO admin_users (org_id, email, password_hash) VALUES
  ('org-uuid', 'sarah@company.com', 'hashed_password');
```

### **2. Admin Logs In:**
```
Email: sarah@company.com
Password: ********
```

### **3. AI Agent Sends Email:**
```
From: Company Hiring <hiring@wathefni.ai>
Reply-To: sarah@company.com  ← Admin's login email
To: candidate@example.com
```

### **4. Candidate Replies:**
```
To: sarah@company.com  ← Goes to admin's real mailbox
```

### **5. Admin Receives:**
```
Sarah's Gmail/Outlook Inbox:
📧 From: candidate@example.com
Subject: Re: Interview Request
"Yes, I'm available Tuesday!"
```

---

## Creating New Admins:

### **Via SQL:**
```sql
INSERT INTO admin_users (org_id, email, password_hash) 
VALUES (
  (SELECT id FROM organizations WHERE slug = 'company-name'),
  'admin@company.com',  -- ← Use real email!
  crypt('password123', gen_salt('bf'))
);
```

### **Via API:**
```bash
POST /api/super-admin/organizations/{orgId}/invite
{
  "email": "admin@company.com",  # ← Real email
  "password": "temp_password"
}
```

---

## Important Notes:

### **✅ DO:**
- Use real mailboxes (Gmail, Outlook, company email)
- Use professional company emails when possible
- Ensure admin has access to the mailbox
- Test email delivery before going live

### **❌ DON'T:**
- Use fake/internal emails (`admin@company.internal`)
- Use shared emails multiple admins can't access
- Use emails that forward to nowhere
- Use temporary/disposable emails

---

## Testing:

### **1. Verify Admin Email:**
```sql
SELECT email FROM admin_users WHERE org_id = 'your-org-id';
```

### **2. Test Email Delivery:**
```bash
# Send test email to the admin's email
# Check if they receive it
```

### **3. Test AI Agent:**
```
Login as admin → Use AI Agent → Send email to test candidate
→ Have candidate reply → Check admin's inbox
```

---

## Migration from Old Setup:

### **If you had contact_email:**

```sql
-- Drop the old approach
ALTER TABLE admin_users DROP COLUMN IF EXISTS contact_email;

-- Verify all admin emails are real mailboxes
SELECT email FROM admin_users;

-- Update any fake emails to real ones
UPDATE admin_users 
SET email = 'real.email@company.com'
WHERE email = 'admin@company.internal';
```

---

## Benefits:

✅ **Simple** - One email field, not two  
✅ **Clear** - Login email = Reply email  
✅ **Professional** - Company emails  
✅ **Easy** - No separate contact email to manage  
✅ **Future-proof** - Works with inbox feature  

---

## Current Status: ✅ READY

- ✅ Code simplified to use login email
- ✅ contact_email column dropped
- ✅ Email sending uses admin login email
- ✅ Ready for inbox feature (future)

**Just ensure all admin emails are real mailboxes!**
