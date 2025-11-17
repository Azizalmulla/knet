# 🚀 New Features Guide - Skills Gap Analysis & Interview Scheduling

## 📋 Overview

Two powerful new features have been added to Wathefni AI:

1. **Skills Gap Analysis** - Understand your talent pool's strengths and weaknesses
2. **Interview Scheduling** - Let candidates book interview slots with zero back-and-forth

---

## 🎯 Feature 1: Skills Gap Analysis

### What It Does

Analyzes all candidates in your organization and provides:
- **Abundant Skills** (>60% of candidates have it)
- **Balanced Skills** (30-60% coverage)
- **Scarce Skills** (<30% coverage)
- **AI Recommendations** for hiring/training
- **Industry Benchmarking** against trending skills

### How to Use

#### For Admins:

1. **Access Skills Gap Dashboard:**
   ```
   Navigate to: /{org}/admin/skills-gap
   ```

2. **View Analysis:**
   - See which skills are well-represented (green)
   - Identify skills gaps (red)
   - Get AI-powered recommendations

3. **Export Data:**
   - Click "Export CSV" to download full analysis
   - Use for presentations or planning

#### API Endpoint:

```typescript
GET /api/{org}/admin/skills-gap
Authorization: Bearer {adminToken}

Response:
{
  totalCandidates: 150,
  abundantSkills: [
    { skill: "excel", count: 120, percentage: 80, category: "abundant" },
    ...
  ],
  balancedSkills: [...],
  scarceSkills: [...],
  recommendations: [
    "High-demand skills gap: Python, Machine Learning, AWS. Consider targeted recruitment...",
    ...
  ],
  industryInsights: {
    topTrendingSkills: ["React", "TypeScript", "Python", ...],
    emergingSkills: ["Rust", "WebAssembly", ...]
  }
}
```

### Use Cases

**Scenario 1: Recruitment Planning**
```
Problem: NBK needs to hire 10 new employees
Solution: 
1. Check Skills Gap dashboard
2. See Python is scarce (only 12% of candidates)
3. Prioritize Python skills in job postings
4. Target coding bootcamp graduates
```

**Scenario 2: Training Programs**
```
Problem: Want to upskill existing talent pool
Solution:
1. View scarce skills (Cybersecurity: 8%)
2. View abundant skills (Excel: 89%)
3. Offer Cybersecurity training to diversify
4. Leverage Excel experts for internal workshops
```

**Scenario 3: Strategic Planning**
```
Problem: C-suite wants talent metrics
Solution:
1. Export CSV of skills analysis
2. Show trending skills your org lacks
3. Present data-driven hiring plan
4. Justify training budget requests
```

---

## 📅 Feature 2: Interview Scheduling

### What It Does

**For Admins:**
- Set available interview time slots
- Auto-generate meeting links (Zoom/Google Meet)
- View all bookings in one calendar
- Manage/cancel interviews

**For Candidates:**
- View available times
- Book interviews in 2 clicks
- Receive instant confirmation email
- Get 24-hour reminder before interview

### Setup Steps

#### 1. Run Database Migration

```bash
# Copy the SQL from migrations/add-interview-scheduling.sql
# Paste into Neon SQL Editor
# Execute
```

**Tables Created:**
- `interview_availability` - Admin's available slots
- `interview_bookings` - Candidate bookings
- `admin_scheduling_preferences` - Admin settings

#### 2. Configure Email (Optional)

Add to `.env`:
```bash
RESEND_API_KEY=your_resend_key_here
```

If not configured, emails won't send but scheduling still works.

#### 3. Admin Sets Availability

1. Go to: `/{org}/admin/schedule`
2. Click "Add Availability"
3. Select date (e.g., Tomorrow)
4. Select start time (e.g., 9:00 AM)
5. Choose duration (30/45/60 min)
6. (Optional) Add Zoom link
7. Click "Create Slots"
8. 8 slots created automatically with 15-min breaks!

#### 4. Share Booking Link

Two options:

**Option A: Copy Link**
```
1. Click "Copy Booking Link" button
2. Share with candidates:
   https://wathefni.ai/nbk/schedule
```

**Option B: Add to Website**
```html
<a href="https://wathefni.ai/nbk/schedule">
  Schedule Interview
</a>
```

**Option C: Add to Job Postings**
```
Include in job description:
"Apply now and book your interview: https://wathefni.ai/nbk/schedule"
```

### How It Works

#### Admin Flow:

```
1. Admin creates availability slots
   ↓
2. System generates meeting links
   ↓
3. Admin shares booking page URL
   ↓
4. Candidate books a slot
   ↓
5. Admin receives email notification
   ↓
6. Both get calendar invite + reminders
```

#### Candidate Flow:

```
1. Candidate visits /{org}/schedule
   ↓
2. Sees available dates/times
   ↓
3. Clicks on preferred slot
   ↓
4. Fills form (name, email, phone)
   ↓
5. Submits booking
   ↓
6. Gets instant confirmation with meeting link
   ↓
7. Receives reminder 24h before interview
```

### API Endpoints

#### 1. Admin: Create Availability

```typescript
POST /api/{org}/admin/schedule/availability
Authorization: Bearer {adminToken}
Content-Type: application/json

Body:
{
  slots: [
    {
      start_time: "2024-11-20T09:00:00Z",
      end_time: "2024-11-20T09:30:00Z",
      duration_minutes: 30,
      meeting_link: "https://zoom.us/j/123456789",
      notes: "Technical interview"
    },
    ...
  ]
}

Response:
{
  success: true,
  message: "Created 8 availability slots",
  slots: [...]
}
```

#### 2. Admin: View Availability

```typescript
GET /api/{org}/admin/schedule/availability?include_booked=true
Authorization: Bearer {adminToken}

Response:
{
  success: true,
  slots: [
    {
      id: "uuid",
      start_time: "2024-11-20T09:00:00Z",
      end_time: "2024-11-20T09:30:00Z",
      duration_minutes: 30,
      is_booked: true,
      meeting_link: "https://...",
      candidate_name: "Ahmed Al-Rashid",
      candidate_email: "ahmed@example.com",
      booking_status: "confirmed"
    },
    ...
  ]
}
```

#### 3. Candidate: View Available Slots

```typescript
GET /api/{org}/schedule/book
// No authentication required

Response:
{
  success: true,
  organization: "National Bank of Kuwait",
  availableSlots: [
    {
      id: "uuid",
      start_time: "2024-11-20T09:00:00Z",
      end_time: "2024-11-20T09:30:00Z",
      duration_minutes: 30,
      admin_email: "hr@nbk.com"
    },
    ...
  ]
}
```

#### 4. Candidate: Book Interview

```typescript
POST /api/{org}/schedule/book
Content-Type: application/json

Body:
{
  availability_id: "uuid",
  candidate_name: "Ahmed Al-Rashid",
  candidate_email: "ahmed@example.com",
  candidate_phone: "+965 1234 5678",
  position_applying_for: "Software Engineer",
  interview_type: "general",
  notes: "I have 5 years of React experience"
}

Response:
{
  success: true,
  message: "Interview booked successfully!",
  booking: {
    id: "uuid",
    start_time: "2024-11-20T09:00:00Z",
    end_time: "2024-11-20T09:30:00Z",
    duration_minutes: 30,
    meeting_link: "https://meet.google.com/abc-defg-hij",
    status: "confirmed"
  }
}
```

#### 5. Admin: Delete Slot

```typescript
DELETE /api/{org}/admin/schedule/availability?slot_id={uuid}
Authorization: Bearer {adminToken}

Response:
{
  success: true,
  message: "Availability slot deleted"
}
```

### Email Templates

#### Candidate Confirmation Email:

```
Subject: Interview Confirmed - National Bank of Kuwait

Hi Ahmed,

Your interview with National Bank of Kuwait has been scheduled.

Date & Time: Wednesday, November 20, 2024 at 9:00 AM
Duration: 30 minutes
Meeting Link: https://meet.google.com/abc-defg-hij
Position: Software Engineer

We'll send you a reminder 24 hours before your interview.

Good luck!
```

#### Admin Notification Email:

```
Subject: New Interview Booked - Ahmed Al-Rashid

Candidate: Ahmed Al-Rashid (ahmed@example.com)
Phone: +965 1234 5678
Date & Time: Wednesday, November 20, 2024 at 9:00 AM
Duration: 30 minutes
Position: Software Engineer
Candidate Notes: I have 5 years of React experience

Meeting Link: https://meet.google.com/abc-defg-hij
```

### UI Screenshots (Described)

#### Admin Dashboard:

```
┌─────────────────────────────────────────────────┐
│  Interview Scheduling                  [+ Add]  │
├─────────────────────────────────────────────────┤
│                                                 │
│  ✅ Available Slots: 12                        │
│  📅 Booked Interviews: 5                       │
│  🕐 Total Slots: 17                            │
│                                                 │
│  Wednesday, November 20, 2024                  │
│  ├─ 9:00 AM - 9:30 AM   [BOOKED] Ahmed        │
│  ├─ 9:45 AM - 10:15 AM  [AVAILABLE] [Delete]  │
│  ├─ 10:30 AM - 11:00 AM [AVAILABLE] [Delete]  │
│  └─ ...                                        │
│                                                 │
└─────────────────────────────────────────────────┘
```

#### Candidate Booking Page:

```
┌─────────────────────────────────────────────────┐
│  Schedule Your Interview                        │
│  Book a time to meet with NBK                   │
├─────────────────────────────────────────────────┤
│                                                 │
│  📅 Wednesday, November 20, 2024               │
│  ┌───────┐ ┌───────┐ ┌───────┐                │
│  │ 9:00  │ │ 9:45  │ │10:30  │                │
│  │  AM   │ │  AM   │ │  AM   │                │
│  └───────┘ └───────┘ └───────┘                │
│                                                 │
│  📅 Thursday, November 21, 2024                │
│  ┌───────┐ ┌───────┐                           │
│  │ 2:00  │ │ 2:45  │                           │
│  │  PM   │ │  PM   │                           │
│  └───────┘ └───────┘                           │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 🔗 Integration Examples

### Example 1: Add to Landing Page

```tsx
// app/page.tsx
<Button asChild>
  <Link href="/nbk/schedule">
    Schedule Interview
  </Link>
</Button>
```

### Example 2: Add to Job Posting

```tsx
// components/JobCard.tsx
<Button onClick={() => router.push(`/${orgSlug}/schedule`)}>
  Book Interview
</Button>
```

### Example 3: Email Template

```html
<p>Interested? Schedule your interview here:</p>
<a href="https://wathefni.ai/nbk/schedule">
  Book Interview Slot
</a>
```

---

## 🎨 Customization

### Change Interview Duration

```typescript
// In admin UI:
duration: 30  // 15, 30, 45, 60, 90, or 120 minutes
```

### Custom Meeting Links

```typescript
// Instead of auto-generated Google Meet:
meeting_link: "https://zoom.us/j/123456789?pwd=abc123"
```

### Time Zone

```typescript
// Default: Asia/Kuwait
// To change, update admin_scheduling_preferences table:
timezone: 'America/New_York'
```

---

## 📊 Database Schema

### interview_availability

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| organization_id | UUID | Which org |
| admin_id | UUID | Which admin |
| start_time | TIMESTAMPTZ | Start of slot |
| end_time | TIMESTAMPTZ | End of slot |
| duration_minutes | INTEGER | Length |
| is_booked | BOOLEAN | Availability status |
| booking_id | UUID | Reference to booking |
| meeting_link | TEXT | Zoom/Meet URL |
| notes | TEXT | Admin notes |

### interview_bookings

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| organization_id | UUID | Which org |
| availability_id | UUID | Which slot |
| candidate_id | UUID | Registered candidate (optional) |
| candidate_name | TEXT | Name |
| candidate_email | TEXT | Email |
| candidate_phone | TEXT | Phone |
| position_applying_for | TEXT | Job title |
| interview_type | TEXT | Type |
| meeting_link | TEXT | Meeting URL |
| status | TEXT | confirmed/cancelled/etc |
| notes | TEXT | Candidate notes |
| admin_notes | TEXT | Private admin notes |

---

## 🐛 Troubleshooting

### Issue 1: Slots Not Showing

**Problem:** Candidate sees "No Available Times"

**Solutions:**
1. Check if admin created slots in the future (not past)
2. Verify `is_booked = false` in database
3. Check organization_id matches

### Issue 2: Emails Not Sending

**Problem:** No confirmation emails

**Solutions:**
1. Check `RESEND_API_KEY` is set
2. Verify Resend domain is verified
3. Check email logs in Resend dashboard

### Issue 3: Double Booking

**Problem:** Two candidates book same slot

**Solutions:**
- This shouldn't happen (we use `FOR UPDATE` lock)
- If it does, check PostgreSQL transaction isolation
- Verify triggers are working

---

## 🚀 Next Steps

### Enhancements You Can Add:

1. **Calendar Sync:**
   - Integrate with Google Calendar API
   - Auto-create calendar events
   - Two-way sync (mark busy times as unavailable)

2. **SMS Reminders:**
   - Use Twilio for SMS notifications
   - Send 1-hour before interview

3. **Recurring Availability:**
   - "Every Monday 9am-5pm"
   - Auto-generate slots for next 4 weeks

4. **Team Scheduling:**
   - Multiple admins on same interview
   - Round-robin slot assignment

5. **Video Recording:**
   - Integrate with Zoom/Meet recording
   - Auto-save to Vercel Blob
   - Link to candidate profile

---

## ✅ Feature Checklist

### Skills Gap Analysis:
- [x] API endpoint created
- [x] Database queries optimized
- [x] Admin dashboard component
- [x] Charts and visualizations
- [x] CSV export functionality
- [x] AI recommendations
- [x] Industry benchmarking

### Interview Scheduling:
- [x] Database migrations
- [x] Admin API routes
- [x] Candidate API routes
- [x] Admin UI (create/manage slots)
- [x] Candidate UI (booking page)
- [x] Email notifications
- [x] Meeting link generation
- [x] Slot locking (prevent double-booking)
- [x] Navigation in admin dashboard

---

## 🎉 You're All Set!

Both features are now live and ready to use. Test them out:

1. **Skills Gap:**
   ```
   https://your-domain.com/nbk/admin/skills-gap
   ```

2. **Interview Scheduling:**
   ```
   Admin: https://your-domain.com/nbk/admin/schedule
   Candidate: https://your-domain.com/nbk/schedule
   ```

**Need help?** Check the code comments or reach out!
