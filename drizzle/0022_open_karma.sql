CREATE TABLE `adaptiveHints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`skillLadderId` int NOT NULL,
	`suggestedMode` enum('story','visual','handsOn','watch','practice','kiwiTalk','tutor','movement') NOT NULL DEFAULT 'practice',
	`softerNext` boolean NOT NULL DEFAULT false,
	`hardCount` int NOT NULL DEFAULT 0,
	`okCount` int NOT NULL DEFAULT 0,
	`easyCount` int NOT NULL DEFAULT 0,
	`reason` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `adaptiveHints_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `parentFlags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`skillLadderId` int,
	`subjectSlug` varchar(32),
	`severity` enum('info','watch','alert') NOT NULL DEFAULT 'watch',
	`title` varchar(200) NOT NULL,
	`body` text,
	`acknowledged` boolean NOT NULL DEFAULT false,
	`acknowledgedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `parentFlags_id` PRIMARY KEY(`id`)
);
