-- Interview Scheduling System
-- =========================
-- Allows admins to share calendar availability and candidates to book interview slots

-- 1. Interview availability slots (admin sets these)
-- -------------------------------------------------
CREATE TABLE IF NOT EXISTS interview_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  
  -- Slot details
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30, -- Interview duration (30, 45, 60 min)
  
  -- Status
  is_booked BOOLEAN DEFAULT FALSE,
  booking_id UUID, -- References interview_bookings when booked
  
  -- Metadata
  meeting_link TEXT, -- Zoom/Google Meet link (auto-generated)
  notes TEXT, -- Admin notes about this slot
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CHECK (end_time > start_time),
  CHECK (duration_minutes IN (15, 30, 45, 60, 90, 120))
);

-- 2. Interview bookings (when candidate books a slot)
-- ---------------------------------------------------
CREATE TABLE IF NOT EXISTS interview_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  availability_id UUID NOT NULL REFERENCES interview_availability(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
  
  -- Candidate info (for non-registered candidates)
  candidate_name TEXT NOT NULL,
  candidate_email TEXT NOT NULL,
  candidate_phone TEXT,
  
  -- Booking details
  position_applying_for TEXT,
  interview_type TEXT DEFAULT 'general' CHECK (interview_type IN ('general', 'technical', 'hr', 'final', 'behavioral')),
  
  -- Meeting info
  meeting_link TEXT NOT NULL, -- Zoom/Google Meet URL
  meeting_password TEXT, -- Optional meeting password
  calendar_event_id TEXT, -- Google Calendar event ID for sync
  
  -- Status
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'rescheduled', 'completed', 'no_show')),
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT, -- 'candidate' or 'admin'
  
  -- Reminders
  reminder_sent_24h BOOLEAN DEFAULT FALSE,
  reminder_sent_1h BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  notes TEXT, -- Candidate notes/questions
  admin_notes TEXT, -- Admin private notes
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Admin scheduling preferences
-- ------------------------------
CREATE TABLE IF NOT EXISTS admin_scheduling_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE UNIQUE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Calendar settings
  timezone TEXT DEFAULT 'Asia/Kuwait', -- Admin timezone
  default_duration INTEGER DEFAULT 30, -- Default interview duration
  buffer_time INTEGER DEFAULT 15, -- Minutes between interviews
  
  -- Availability windows (JSON)
  weekly_schedule JSONB DEFAULT '{
    "monday": [{"start": "09:00", "end": "17:00"}],
    "tuesday": [{"start": "09:00", "end": "17:00"}],
    "wednesday": [{"start": "09:00", "end": "17:00"}],
    "thursday": [{"start": "09:00", "end": "17:00"}],
    "sunday": [{"start": "09:00", "end": "17:00"}]
  }'::jsonb,
  
  -- Meeting preferences
  default_meeting_provider TEXT DEFAULT 'zoom' CHECK (default_meeting_provider IN ('zoom', 'google_meet', 'teams', 'manual')),
  zoom_personal_meeting_id TEXT,
  google_meet_enabled BOOLEAN DEFAULT FALSE,
  
  -- Notification preferences
  send_confirmation_email BOOLEAN DEFAULT TRUE,
  send_reminder_24h BOOLEAN DEFAULT TRUE,
  send_reminder_1h BOOLEAN DEFAULT TRUE,
  
  -- Booking page customization
  welcome_message TEXT DEFAULT 'Thank you for your interest! Please select a convenient time for your interview.',
  instructions TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Indexes for performance
-- --------------------------
CREATE INDEX IF NOT EXISTS idx_availability_org_admin ON interview_availability(organization_id, admin_id);
CREATE INDEX IF NOT EXISTS idx_availability_time ON interview_availability(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_availability_booked ON interview_availability(is_booked) WHERE is_booked = false;

CREATE INDEX IF NOT EXISTS idx_bookings_org ON interview_bookings(organization_id);
CREATE INDEX IF NOT EXISTS idx_bookings_candidate ON interview_bookings(candidate_email);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON interview_bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_created ON interview_bookings(created_at DESC);

-- 5. Trigger to mark availability as booked
-- ----------------------------------------
CREATE OR REPLACE FUNCTION mark_availability_booked()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE interview_availability
  SET 
    is_booked = TRUE,
    booking_id = NEW.id,
    updated_at = now()
  WHERE id = NEW.availability_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_mark_availability_booked ON interview_bookings;
CREATE TRIGGER trigger_mark_availability_booked
AFTER INSERT ON interview_bookings
FOR EACH ROW
EXECUTE FUNCTION mark_availability_booked();

-- 6. Trigger to unmark availability when booking cancelled
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION unmark_availability_on_cancel()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'rescheduled') AND OLD.status = 'confirmed' THEN
    UPDATE interview_availability
    SET 
      is_booked = FALSE,
      booking_id = NULL,
      updated_at = now()
    WHERE id = NEW.availability_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_unmark_availability_on_cancel ON interview_bookings;
CREATE TRIGGER trigger_unmark_availability_on_cancel
AFTER UPDATE ON interview_bookings
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION unmark_availability_on_cancel();

-- 7. Function to generate available time slots
-- -------------------------------------------
CREATE OR REPLACE FUNCTION generate_weekly_slots(
  p_admin_id UUID,
  p_start_date DATE,
  p_weeks INTEGER DEFAULT 2
)
RETURNS TABLE (
  slot_start TIMESTAMPTZ,
  slot_end TIMESTAMPTZ,
  duration INTEGER
) AS $$
DECLARE
  v_prefs RECORD;
  v_current_date DATE;
  v_day_name TEXT;
  v_schedule JSONB;
  v_time_slot JSONB;
  v_slot_start TIMESTAMPTZ;
  v_slot_end TIMESTAMPTZ;
BEGIN
  -- Get admin preferences
  SELECT * INTO v_prefs
  FROM admin_scheduling_preferences
  WHERE admin_id = p_admin_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Admin scheduling preferences not found';
  END IF;
  
  -- Loop through dates
  FOR v_current_date IN 
    SELECT generate_series(
      p_start_date,
      p_start_date + (p_weeks * 7),
      '1 day'::interval
    )::date
  LOOP
    v_day_name := lower(to_char(v_current_date, 'Day'));
    v_day_name := trim(v_day_name);
    
    -- Get schedule for this day
    v_schedule := v_prefs.weekly_schedule -> v_day_name;
    
    IF v_schedule IS NOT NULL THEN
      -- Loop through time slots for this day
      FOR v_time_slot IN SELECT * FROM jsonb_array_elements(v_schedule)
      LOOP
        v_slot_start := (v_current_date || ' ' || (v_time_slot->>'start'))::timestamptz;
        v_slot_end := v_slot_start + (v_prefs.default_duration || ' minutes')::interval;
        
        -- Return slot if not already booked
        IF NOT EXISTS (
          SELECT 1 FROM interview_availability
          WHERE admin_id = p_admin_id
          AND start_time = v_slot_start
          AND is_booked = TRUE
        ) THEN
          slot_start := v_slot_start;
          slot_end := v_slot_end;
          duration := v_prefs.default_duration;
          RETURN NEXT;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 8. Verify setup
-- ---------------
SELECT 
  '✅ Interview scheduling tables created successfully!' as status,
  (SELECT COUNT(*) FROM interview_availability) as total_slots,
  (SELECT COUNT(*) FROM interview_bookings) as total_bookings;
