# Demo-Day Smoke Test (60 seconds)

## Quick Validation Checklist

### 1. Upload Flow (20s)
```
1. Navigate to /upload
2. Select Field of Study (e.g., "Engineering") 
3. Select Area of Interest (e.g., "Software Development")
4. Verify suggested vacancies appear
5. Upload sample PDF CV
6. Check toast success message appears
```

### 2. AI Builder Flow (25s)
```
1. Navigate to /ai-builder  
2. Fill Personal Info step (name, email, phone)
3. Skip to Review step via navigation
4. Select Field of Study and Area of Interest
5. Click "Export PDF" - verify download starts
6. Click "Submit CV" - verify success toast
```

### 3. Admin Dashboard (15s)
```
1. Navigate to /admin
2. Filter by Field/Area using dropdowns
3. Click eye icon to reveal masked email/phone
4. Click "Export CSV" button
5. Verify CSV downloads with proper data
```

## Expected Results

### ✅ Success Indicators
- All pages load within 3 seconds
- No 404 or 500 errors in browser console
- Form submissions return success messages
- File uploads/downloads work correctly
- Admin filtering and CSV export functional
- PII masking toggles work as expected

### ❌ Failure Indicators
- Any page fails to load
- JavaScript errors in console
- Forms fail to submit or show errors
- File operations timeout or fail
- Admin features don't respond
- Rate limiting blocks normal usage

## Pre-Demo Setup

### Environment Check
```bash
# Verify production environment
curl https://your-app.vercel.app/api/health
# Expected: 200 OK

# Check rate limiting is active
curl -X POST https://your-app.vercel.app/api/cv/submit -H "Content-Type: application/json" -d '{}'
# Expected: 400 or rate limit response
```

### Test Data Preparation
- Have sample PDF CV ready (< 5MB)
- Know test email: demo@knet.kw
- Have admin key available
- Clear browser cache/localStorage

## Troubleshooting

### Common Issues
1. **Upload fails**: Check file size < 10MB, valid PDF format
2. **AI Builder slow**: OpenAI API may be rate-limited, wait 30s
3. **Admin auth fails**: Verify ADMIN_KEY environment variable
4. **Rate limit hit**: Wait 5 minutes or test from different IP
5. **PDF generation fails**: Check OpenAI API key and quota

### Emergency Rollback
```bash
vercel rollback --yes
# Rollback to last known good deployment
```

## Demo Script (Copy/Paste)

**"Let me show you our AI CV Builder in action..."**

1. **Upload**: "Students can upload existing CVs and get matched to relevant opportunities"
2. **AI Builder**: "Or create professional CVs from scratch with AI assistance" 
3. **Admin**: "HR teams can review submissions with built-in privacy controls"

**Total demo time: ~60 seconds**

---

**Pre-Demo Checklist:**
- [ ] Run `npm run e2e:smoke` locally
- [ ] Verify production environment variables
- [ ] Test admin authentication
- [ ] Clear browser data
- [ ] Have sample files ready
