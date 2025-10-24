#!/bin/bash

# Test script for admin decisions functionality
# Run this manually: chmod +x test-admin-decisions.sh && ./test-admin-decisions.sh

DB_URL="postgresql://neondb_owner:npg_xbmGHYX6oR8p@ep-sparkling-glade-adspllw0-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

echo "=== Testing Admin Decisions Setup ==="

echo "1. Adding reason column to candidate_decisions..."
psql "$DB_URL" -c "ALTER TABLE IF EXISTS public.candidate_decisions ADD COLUMN IF NOT EXISTS reason TEXT;" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✓ Column added/exists"
else
    echo "✗ Failed to add column"
    exit 1
fi

echo "2. Verifying column exists..."
REASON_COL=$(psql "$DB_URL" -At -c "SELECT column_name FROM information_schema.columns WHERE table_name='candidate_decisions' AND column_name='reason';" 2>/dev/null)
if [ "$REASON_COL" = "reason" ]; then
    echo "✓ Reason column exists"
else
    echo "✗ Reason column not found"
    exit 1
fi

echo "3. Getting sample org and candidate..."
SAMPLE=$(psql "$DB_URL" -At -c "SELECT o.slug||'|'||c.id::text FROM candidates c JOIN organizations o ON o.id=c.org_id LIMIT 1;" 2>/dev/null)
if [ -n "$SAMPLE" ]; then
    ORG=$(echo "$SAMPLE" | cut -d'|' -f1)
    CID=$(echo "$SAMPLE" | cut -d'|' -f2)
    echo "✓ Found org: $ORG, candidate: $CID"
else
    echo "✗ No candidates found"
    exit 1
fi

echo "4. Testing dev server availability..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null)
if [ "$STATUS" = "200" ]; then
    echo "✓ Dev server running"
else
    echo "✗ Dev server not responding (status: $STATUS)"
    echo "   Start it with: npm run dev"
    exit 1
fi

echo "5. Testing admin decision endpoint..."
RESPONSE=$(curl -s -X POST "http://localhost:3000/api/$ORG/admin/candidates/$CID/decision" \
  -H "x-admin-key: test-admin-key" \
  -H "Content-Type: application/json" \
  -d '{"status":"rejected","reason":"Test reason from script"}' 2>/dev/null)

echo "   Response: $RESPONSE"

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✓ Decision endpoint works"
else
    echo "✗ Decision endpoint failed"
fi

echo "6. Verifying database update..."
DB_ROW=$(psql "$DB_URL" -At -c "SELECT status||'|'||COALESCE(reason,'')||'|'||COALESCE(updated_at::text,'') FROM candidate_decisions WHERE candidate_id='$CID'::uuid;" 2>/dev/null)
if [ -n "$DB_ROW" ]; then
    STATUS_DB=$(echo "$DB_ROW" | cut -d'|' -f1)
    REASON_DB=$(echo "$DB_ROW" | cut -d'|' -f2)
    echo "✓ Database updated: status=$STATUS_DB, reason='$REASON_DB'"
else
    echo "✗ No decision record found in database"
fi

echo "7. Testing admin GET API..."
ADMIN_API=$(curl -s -H "x-admin-key: test-admin-key" "http://localhost:3000/api/$ORG/admin/students" 2>/dev/null | head -c 200)
if echo "$ADMIN_API" | grep -q 'decision_status'; then
    echo "✓ Admin GET includes decision fields"
else
    echo "✗ Admin GET missing decision fields"
fi

echo ""
echo "=== Test Complete ==="
echo "If all steps show ✓, the admin decisions feature is working!"
echo "Visit http://localhost:3000/$ORG/admin to test the UI"
