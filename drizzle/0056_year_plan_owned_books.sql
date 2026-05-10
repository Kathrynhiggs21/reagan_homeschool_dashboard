-- 0056 — Year-plan backbone + owned-books registry + blocked-emails guard.
--
-- yearPlan: the per-subject ordered list of curriculum topics the AI advances
--   through across the school year. One row per (subject, topic, plannedWeek)
--   slot. AI day-builder pulls the next pending row by sequenceOrder for each
--   subject. Cursor advances when a scheduleBlock that referenced this row's
--   topic is marked complete.
--
-- yearPlanCursor: per-subject "next sequenceOrder to assign" pointer.
--
-- ownedBooks: physical books Reagan owns. AI references these by next un-done
--   unit (page / day / chapter) when the day's subject matches. Reduces
--   reliance on AI-generated worksheets when a real book covers the topic.
--
-- blockedEmails: hard list of email addresses the dashboard refuses to use
--   for OAuth / sync / app-account creation. Seeded with reagan.higgs33@ihsd.us.
CREATE TABLE IF NOT EXISTS `yearPlan` (
  `id` int NOT NULL AUTO_INCREMENT,
  `subject_slug` varchar(64) NOT NULL,
  `topic_id` int DEFAULT NULL,                          -- FK to curriculumTopics (nullable: AI may plan a topic before it's in the catalog)
  `topic_code` varchar(48) DEFAULT NULL,                -- denormalized for fast lookups
  `topic_title` varchar(512) NOT NULL,                  -- denormalized so plan survives topic edits
  `sequence_order` int NOT NULL DEFAULT 0,              -- AI advances by this within subject
  `planned_week` varchar(16) DEFAULT NULL,              -- e.g. "2026-W19"; nullable when unscheduled
  `target_date` date DEFAULT NULL,                      -- best-effort target (June 5 stretch / Aug 15 catch)
  `status` varchar(16) NOT NULL DEFAULT 'pending',      -- pending | in_progress | done | skipped
  `completed_at` timestamp NULL DEFAULT NULL,
  `completed_by_block_id` int DEFAULT NULL,
  `is_main` tinyint(1) NOT NULL DEFAULT 1,              -- 1 = required for main June 5 finish; 0 = enrichment
  `notes` text,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_yearplan_subject_seq` (`subject_slug`, `sequence_order`),
  KEY `idx_yearplan_status` (`status`)
);

CREATE TABLE IF NOT EXISTS `yearPlanCursor` (
  `subject_slug` varchar(64) NOT NULL,
  `current_sequence_order` int NOT NULL DEFAULT 0,
  `last_advanced_at` timestamp NULL DEFAULT NULL,
  `notes` text,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`subject_slug`)
);

CREATE TABLE IF NOT EXISTS `ownedBooks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(256) NOT NULL,
  `author` varchar(256) DEFAULT NULL,
  `isbn` varchar(32) DEFAULT NULL,
  `subject_slug` varchar(64) NOT NULL,
  `unit_kind` varchar(16) NOT NULL DEFAULT 'page',      -- page | day | chapter | lesson
  `total_units` int NOT NULL DEFAULT 0,
  `cursor_unit` int NOT NULL DEFAULT 1,                 -- next un-done unit (1-indexed)
  `pages_per_session` int NOT NULL DEFAULT 2,
  `notes` text,
  `last_advanced_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ownedbooks_subject` (`subject_slug`)
);

CREATE TABLE IF NOT EXISTS `blockedEmails` (
  `email` varchar(255) NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`email`)
);

-- Seed: hard block on the inactive ihsd.us account. The dashboard refuses any
-- OAuth / sync / app-account creation against this email.
INSERT IGNORE INTO `blockedEmails` (`email`, `reason`)
VALUES ('reagan.higgs33@ihsd.us', 'Inactive school account (replaced by reaganhiggs910@gmail.com on 2026-05-08).');

-- Seed Reagan's printed books. Page totals are conservative approximations
-- for 5th-grade editions (real total can be edited via the AdultBooks UI).
INSERT IGNORE INTO `ownedBooks` (`title`, `author`, `subject_slug`, `unit_kind`, `total_units`, `cursor_unit`, `pages_per_session`, `notes`)
VALUES
  ('Spectrum Math Grade 5', 'Spectrum / Carson Dellosa', 'math', 'page', 175, 1, 2, 'Seeded 2026-05-08. Adjust cursor as Reagan progresses.'),
  ('Spectrum Science Grade 5', 'Spectrum / Carson Dellosa', 'science', 'page', 160, 1, 2, 'Seeded 2026-05-08.'),
  ('180 Days of Language for 5th Grade', 'Shell Education', 'ela', 'day', 180, 1, 1, 'Seeded 2026-05-08. Advance one Day at a time.'),
  ('Tuck Everlasting', 'Natalie Babbitt', 'reading', 'chapter', 25, 1, 1, 'Seeded 2026-05-08. ~25 short chapters.'),
  ('Michael''s World', 'Marcy Spear', 'reading', 'chapter', 12, 1, 1, 'Seeded 2026-05-08. Family book.');

-- Seed cursors at 0 for each subject we plan to pace. AI day-builder advances
-- these as it slots blocks.
INSERT IGNORE INTO `yearPlanCursor` (`subject_slug`, `current_sequence_order`)
VALUES
  ('math', 0),
  ('ela', 0),
  ('science', 0),
  ('social', 0),
  ('reading', 0);
