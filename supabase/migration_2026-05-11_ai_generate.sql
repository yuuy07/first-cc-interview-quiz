-- Migration: Add ai_generated support for AI-generated wrong answers
-- 2026-05-11

-- 1. Allow ai_generated session type
alter table user_progress drop constraint if exists chk_session_type;
alter table user_progress add constraint chk_session_type
  check (session_type in ('quiz', 'mock_interview', 'ai_generated'));

-- 2. Allow inserting AI-generated questions (no source_id needed)
--    No schema change needed - questions table already allows null source_id
