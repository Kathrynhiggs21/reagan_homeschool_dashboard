CREATE TABLE `assignmentBacklog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(20) NOT NULL,
	`title` varchar(200) NOT NULL,
	`subjectSlug` varchar(32) NOT NULL,
	`blockType` varchar(40),
	`estMinutes` int NOT NULL DEFAULT 25,
	`weekTheme` varchar(80),
	`dayHint` varchar(16),
	`notes` text,
	`iepGoal` boolean NOT NULL DEFAULT false,
	`active` boolean NOT NULL DEFAULT true,
	`sourceDoc` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assignmentBacklog_id` PRIMARY KEY(`id`),
	CONSTRAINT `assignmentBacklog_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `learnerProfile` ADD `weeklyScheduleTemplate` json;