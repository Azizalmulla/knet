# KNET Admin Dashboard - User Guide

## Getting Started

### 1. Accessing the Admin Dashboard
1. Navigate to `/admin` in your browser
2. Enter your admin key when prompted
3. Click "Access Dashboard" to log in

**Security Features:**
- Sessions expire after 30 minutes of inactivity
- Automatic logout if session becomes invalid
- Rate limiting prevents brute force attempts (5 attempts per 5 minutes)

### 2. Dashboard Overview
The admin dashboard displays all CV submissions with the following information:
- **Student Name** - Full name of applicant
- **Email** - Contact email address  
- **Phone** - Contact phone number
- **Field of Study** - Academic background
- **Area of Interest** - Career focus area
- **CV Type** - "AI Generated" or "Uploaded"
- **Submission Date** - When CV was submitted
- **Suggested Vacancies** - Job recommendations

## Privacy & Data Protection

### PII Masking (Default Security Mode)
By default, sensitive personal information is masked:
- **Names**: `J*** S***` (first letter + last letter shown)
- **Emails**: `***@***.***`
- **Phones**: `***-***-****`

### Revealing Personal Information
**Global Toggle:**
- Click "Show All PII" to reveal all data
- Click "Hide All PII" to mask all data again

**Individual Row Toggle:**
- Click the eye icon (👁️) next to any row to reveal that person's data
- Click again to hide it

**Important:** Only reveal PII when necessary for legitimate business purposes.

## Filtering and Search

### Search Bar
- Type any text to search across all fields
- Searches names, emails, fields of study, areas of interest

### Filter Dropdowns
- **Field of Study**: Filter by academic background
- **Area of Interest**: Filter by career focus
- **CV Type**: Filter by submission method (AI/Upload)
- **Suggested Vacancies**: Filter by job recommendations

### Clear Filters
Click "Clear" to reset all filters and show all submissions.

## Data Export

### CSV Export
1. Apply any desired filters first
2. Toggle PII visibility as needed (masked/revealed data will be exported as displayed)
3. Click "Export CSV" button
4. File downloads automatically with timestamp in filename

**Export includes:**
- All visible data based on current filters
- PII masked or revealed based on current privacy setting
- Timestamp of export in filename

## Security Best Practices

### Session Management
- **Auto-logout**: System logs you out after 30 minutes of inactivity
- **Manual logout**: Click "Logout" button when finished
- **Session expiry**: Clear notifications will appear if session expires

### Data Handling
- **Minimize PII exposure**: Only reveal when necessary
- **Regular audits**: All login attempts are logged with IP and timestamp
- **Secure environment**: Admin access blocked on preview deployments

### Key Rotation
- Admin keys are rotated monthly on the 1st
- You'll receive new keys via secure channels
- Contact IT immediately if you suspect key compromise

## Troubleshooting

### Login Issues
**"Invalid key" error:**
- Verify you're using the current admin key
- Check for typos or extra spaces
- Contact IT if key appears correct

**"Too many attempts" error:**
- Wait 5 minutes before trying again
- Rate limiting protects against brute force attacks

### Session Problems
**Unexpected logout:**
- May be due to inactivity timeout (30 minutes)
- Could indicate session security issue
- Simply log back in with your admin key

### Data Display Issues
**Missing students:**
- Check if filters are applied
- Clear all filters to see full list
- Refresh page if data seems outdated

**PII not showing:**
- Ensure you've clicked "Show All PII" or individual eye icons
- Privacy masking is enabled by default for security

## Support Contacts

**Technical Issues:**
- Development Team: [Insert contact]
- System Administrator: [Insert contact]

**Admin Key Issues:**
- IT Security: [Insert contact]
- Project Manager: [Insert contact]

**Data/Privacy Concerns:**
- Data Protection Officer: [Insert contact]
- Legal Team: [Insert contact]

---

**Remember:** This system contains sensitive personal data. Always follow KNET's data protection policies and handle information responsibly.

**Last Updated:** September 2024
