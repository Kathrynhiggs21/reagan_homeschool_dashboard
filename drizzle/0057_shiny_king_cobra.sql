CREATE TABLE `actualAgendaEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date_iso` varchar(10) NOT NULL,
	`planned_block_id` int,
	`subject_slug` varchar(32) NOT NULL,
	`topic` varchar(240) NOT NULL,
	`minutes_spent` int NOT NULL DEFAULT 0,
	`source` enum('reagan-checkin','mom-input','grandma-recap','tutor-note','kiwi-listened','auto-derived') NOT NULL,
	`notes` text,
	`created_by` varchar(240),
	`created_at` bigint NOT NULL,
	CONSTRAINT `actualAgendaEntries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dailyRecapRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date_iso` varchar(10) NOT NULL,
	`sent_to` varchar(240) NOT NULL,
	`sent_at` bigint NOT NULL,
	`reply_token` varchar(96) NOT NULL,
	`status` enum('sent','replied','expired') NOT NULL DEFAULT 'sent',
	`replied_at` bigint,
	`parsed_entries_count` int NOT NULL DEFAULT 0,
	`raw_reply_text` text,
	CONSTRAINT `dailyRecapRequests_id` PRIMARY KEY(`id`),
	CONSTRAINT `dailyRecapRequests_reply_token_unique` UNIQUE(`reply_token`)
);
--> statement-breakpoint
CREATE TABLE `pendingApprovals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kind` varchar(64) NOT NULL,
	`summary` varchar(500) NOT NULL,
	`payload_json` text NOT NULL,
	`requested_by` varchar(255) NOT NULL,
	`requested_at` bigint NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'pending',
	`ai_decision` varchar(32),
	`ai_reason` varchar(500),
	`decided_by` varchar(255),
	`decided_at` bigint,
	`expires_at` bigint NOT NULL,
	CONSTRAINT `pendingApprovals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recipientPushTargets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`display_name` varchar(120) NOT NULL,
	`role` varchar(32) NOT NULL,
	`phone_e164` varchar(32),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` bigint NOT NULL,
	CONSTRAINT `recipientPushTargets_id` PRIMARY KEY(`id`),
	CONSTRAINT `recipientPushTargets_display_name_unique` UNIQUE(`display_name`)
);
--> statement-breakpoint
CREATE TABLE `topicsCoveredOffPlan` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date_iso` varchar(10) NOT NULL,
	`subject_slug` varchar(32) NOT NULL,
	`topic` varchar(240) NOT NULL,
	`mapped_to_standard_id` varchar(64),
	`source_entry_id` int,
	`drive_pushed` boolean NOT NULL DEFAULT false,
	`drive_path` varchar(480),
	`created_at` bigint NOT NULL,
	CONSTRAINT `topicsCoveredOffPlan_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tutorRosterOverride` (
	`id` int AUTO_INCREMENT NOT NULL,
	`week_start_date` varchar(10) NOT NULL,
	`active_tutor_names_json` text NOT NULL,
	`helper_names_json` text NOT NULL,
	`note` varchar(500),
	`created_at` bigint NOT NULL,
	CONSTRAINT `tutorRosterOverride_id` PRIMARY KEY(`id`),
	CONSTRAINT `tutorRosterOverride_week_start_date_unique` UNIQUE(`week_start_date`)
);
