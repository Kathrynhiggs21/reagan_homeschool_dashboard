-- Slice 3.5 — AI auto-approver + Manus push escalation + tutor roster override
--
-- pendingApprovals: queue of risky changes the AI auto-approver flagged for
--   adult review. AI may also auto-approve and write a row with status='auto_approved'
--   for transparency. Status: 'pending' | 'auto_approved' | 'approved' | 'rejected' | 'expired'.
--
-- tutorRosterOverride: weekly override of which tutors are on the active roster.
--   When a row is active for the current week, only listed tutors appear in the
--   day-tutor dropdown / calendar invites / approval CC list. weekStartDate is the
--   Monday of the week (YYYY-MM-DD).
--
-- recipientPushTargets: who receives Manus push notifications for approval pings.
--   role: 'parent' | 'grandparent' | 'tutor'. Active flag lets us toggle without
--   deleting the row. (Phone numbers stored for future Twilio swap; not used today.)

CREATE TABLE IF NOT EXISTS `pendingApprovals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `kind` varchar(64) NOT NULL,
  `summary` varchar(500) NOT NULL,
  `payload_json` text NOT NULL,
  `requested_by` varchar(255) NOT NULL,
  `requested_at` bigint NOT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'pending',
  `ai_decision` varchar(32) DEFAULT NULL,
  `ai_reason` varchar(500) DEFAULT NULL,
  `decided_by` varchar(255) DEFAULT NULL,
  `decided_at` bigint DEFAULT NULL,
  `expires_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pendingApprovals_status` (`status`),
  KEY `idx_pendingApprovals_expires` (`expires_at`)
);

CREATE TABLE IF NOT EXISTS `tutorRosterOverride` (
  `id` int NOT NULL AUTO_INCREMENT,
  `week_start_date` varchar(10) NOT NULL,
  `active_tutor_names_json` text NOT NULL,
  `helper_names_json` text NOT NULL,
  `note` varchar(500) DEFAULT NULL,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_roster_week` (`week_start_date`)
);

CREATE TABLE IF NOT EXISTS `recipientPushTargets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `display_name` varchar(120) NOT NULL,
  `role` varchar(32) NOT NULL,
  `phone_e164` varchar(32) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_recipient_name` (`display_name`)
);

-- Seed: this week's roster (May 11 - May 17, 2026): Keith only as active tutor;
-- Mom + Grandma as helpers.
INSERT IGNORE INTO `tutorRosterOverride`
  (`week_start_date`, `active_tutor_names_json`, `helper_names_json`, `note`, `created_at`)
VALUES
  ('2026-05-11',
   '["Keith"]',
   '["Mom","Grandma"]',
   'No tutors this week except Keith. Mom and Grandma help only.',
   UNIX_TIMESTAMP() * 1000);

-- Seed: push targets for Mom + Grandma (phone numbers stored for future Twilio
-- swap; today notifications go through Manus push only).
INSERT IGNORE INTO `recipientPushTargets`
  (`display_name`, `role`, `phone_e164`, `is_active`, `created_at`)
VALUES
  ('Mom',     'parent',     '+15139265808', 1, UNIX_TIMESTAMP() * 1000),
  ('Grandma', 'grandparent','+15136469281', 1, UNIX_TIMESTAMP() * 1000);
