CREATE TABLE `blockedEmails` (
	`email` varchar(255) NOT NULL,
	`reason` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blockedEmails_email` PRIMARY KEY(`email`)
);
--> statement-breakpoint
CREATE TABLE `ownedBooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(256) NOT NULL,
	`author` varchar(256),
	`isbn` varchar(32),
	`subject_slug` varchar(64) NOT NULL,
	`unit_kind` varchar(16) NOT NULL DEFAULT 'page',
	`total_units` int NOT NULL DEFAULT 0,
	`cursor_unit` int NOT NULL DEFAULT 1,
	`pages_per_session` int NOT NULL DEFAULT 2,
	`notes` text,
	`last_advanced_at` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ownedBooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `yearPlan` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subject_slug` varchar(64) NOT NULL,
	`topic_id` int,
	`topic_code` varchar(48),
	`topic_title` varchar(512) NOT NULL,
	`sequence_order` int NOT NULL DEFAULT 0,
	`planned_week` varchar(16),
	`target_date` date,
	`status` varchar(16) NOT NULL DEFAULT 'pending',
	`completed_at` timestamp,
	`completed_by_block_id` int,
	`is_main` boolean NOT NULL DEFAULT true,
	`notes` text,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `yearPlan_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `yearPlanCursor` (
	`subject_slug` varchar(64) NOT NULL,
	`current_sequence_order` int NOT NULL DEFAULT 0,
	`last_advanced_at` timestamp,
	`notes` text,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `yearPlanCursor_subject_slug` PRIMARY KEY(`subject_slug`)
);
