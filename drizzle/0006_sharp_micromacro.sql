CREATE TABLE `helpList` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`note` text,
	`subjectSlug` varchar(32),
	`status` enum('open','in_progress','resolved') NOT NULL DEFAULT 'open',
	`priority` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `helpList_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `journalEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` date NOT NULL,
	`title` varchar(200),
	`body` text NOT NULL,
	`mood` varchar(16),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `journalEntries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `learnerProfile` MODIFY COLUMN `companionAvatar` varchar(16) DEFAULT '⭐';--> statement-breakpoint
ALTER TABLE `learnerProfile` ADD `photoUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `learnerProfile` ADD `theme` varchar(32) DEFAULT 'chalkboard' NOT NULL;--> statement-breakpoint
ALTER TABLE `learnerProfile` ADD `voiceMode` varchar(16) DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE `learnerProfile` ADD `onboardingCompleted` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `learnerProfile` ADD `adultPasscode` varchar(8) DEFAULT '3918' NOT NULL;