v# AI CV Builder Operations Runbook

## Quick Response Procedures

### Scale Spike (High Traffic)
```bash
# 1. Raise Vercel concurrency limits
vercel env add VERCEL_FUNCTION_MAX_DURATION 60s
vercel env add VERCEL_FUNCTION_MEMORY 1024mb

# 2. Enable Neon compute burst scaling
# Go to Neon console → Settings → Compute → Enable Autoscaling

# 3. Turn on cache headers for static assets
vercel env add CACHE_HEADERS "public, max-age=31536000, immutable"
```

### OpenAI 429/Timeout Issues
```javascript
// Fallback strategy in /app/api/ai/rewrite/route.ts
const fallbackModel = process.env.OPENAI_FALLBACK_MODEL || 'gpt-3.5-turbo';

// For draft generation: use gpt-3.5-turbo
// For polishing: keep gpt-4o-mini for quality
```

### Blob/Database Outage
```javascript
// Client-side queue in localStorage
// Show message: "We saved your draft locally—try again"
localStorage.setItem('knet_pending_submission', JSON.stringify({
  data: formData,
  timestamp: Date.now(),
  retryCount: 0
}));
```

### GDPR/PII Deletion Request
```bash
# 1. Lookup by email in database
SELECT id, blob_url FROM cv_submissions WHERE email = 'user@example.com';

# 2. Delete Blob object
DELETE FROM blob_storage WHERE url = 'blob_url_here';

# 3. Delete DB row
DELETE FROM cv_submissions WHERE email = 'user@example.com';

# 4. Log completion
INSERT INTO audit_log (action, details) VALUES ('PII_DELETE_OK', 'email@example.com');
```

### Feature Flag Hotfix
```bash
# Use Vercel Edge Config for risky feature toggles
vercel env add FEATURE_AI_BUILDER true
vercel env add FEATURE_ADMIN_EXPORT true
vercel env add FEATURE_RATE_LIMITING true
```

## Monitoring & Alerts

### Vercel Alerts Setup
- **Error Rate**: ≥ 10 errors/minute
- **Response Time**: P95 > 5 seconds
- **Function Timeout**: Any function timeout

### Log Drains Configuration
```bash
# Datadog/Splunk integration
vercel integration add datadog
# Filter: severity >= ERROR
```

### OpenAI Monitoring
- **Rate Limits**: 429 responses → Slack alert
- **Timeouts**: Request > 30s → Email alert
- **Cost**: Daily spend > $50 → Budget alert

### Uptime Checks
- **Primary**: `/upload` every 2 minutes
- **Secondary**: `/ai-builder` every 5 minutes
- **Admin**: `/admin` every 10 minutes (with auth bypass)

## Environment Variables Checklist

### Production (Vercel)
- ✅ `OPENAI_API_KEY` - OpenAI API access
- ✅ `POSTGRES_URL` - Neon database connection
- ✅ `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage
- ✅ `ADMIN_KEY` - Admin dashboard authentication
- ❌ `NEXT_PUBLIC_DISABLE_AUTOSAVE` - Only in test environments

### Test/Staging
- ✅ `NEXT_PUBLIC_DISABLE_AUTOSAVE=true` - Disable autosave in E2E
- ✅ `NEXT_PUBLIC_E2E=true` - E2E test detection
- ✅ `TEST_DATABASE_URL` - Separate test database

## Database Maintenance

### Nightly Backups (Neon)
- **Schedule**: 02:00 UTC daily
- **Retention**: 30 days
- **Location**: Neon automatic backups

### Read-Only Analytics Role
```sql
CREATE ROLE analytics_readonly;
GRANT SELECT ON cv_submissions TO analytics_readonly;
GRANT SELECT ON career_map TO analytics_readonly;
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES FROM analytics_readonly;
```

## Security Verification

### Admin Authentication
```bash
curl -H "Authorization: Bearer wrong_key" https://app.knet.kw/admin
# Expected: 401 Unauthorized
```

### Rate Limiting Test
```bash
for i in {1..6}; do
  curl -X POST https://app.knet.kw/api/submit -d '{}' -H "Content-Type: application/json"
done
# Expected: 6th request returns 429
```

### Log Redaction Check
```bash
# Verify no PII in logs
grep -i "email\|phone\|password" /var/log/app.log
# Should return masked values only: email: "***@***.***"
```

## Storage Configuration

### Vercel Blob Settings
- **Access**: Private (no public URLs)
- **Lifecycle**: 365-day expiry on CV files
- **Admin Proxy**: `/api/admin/blob/[id]` with auth check

### File Size Limits
- **CV Upload**: 10MB maximum
- **Generated PDF**: 5MB maximum
- **Concurrent Uploads**: 50 per minute per IP

## Incident Response

### Severity Levels
1. **Critical**: Site down, data loss
2. **High**: Feature broken, security issue  
3. **Medium**: Performance degraded
4. **Low**: Minor UI issue

### Communication Channels
- **Critical**: Phone + Slack #incidents
- **High**: Slack #alerts + Email
- **Medium**: Slack #ops
- **Low**: Ticket system

### Recovery Procedures
1. **Rollback**: `vercel rollback --yes`
2. **Scale Down**: Disable expensive features via Edge Config
3. **Maintenance Mode**: Static page with ETA
4. **Data Recovery**: Restore from Neon backup

---

**Last Updated**: 2024-09-10  
**Next Review**: Monthly
