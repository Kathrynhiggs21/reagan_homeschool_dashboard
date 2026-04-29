CREATE TABLE `gameBreakLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gamePrefId` int,
	`reason` enum('earnedReward','frustrationBreak','kidPicked') NOT NULL DEFAULT 'kidPicked',
	`durationMinutes` int NOT NULL DEFAULT 10,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`endedAt` timestamp,
	CONSTRAINT `gameBreakLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gamePrefs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(120) NOT NULL,
	`kind` enum('web','app','console','offline') NOT NULL DEFAULT 'app',
	`url` varchar(600),
	`emoji` varchar(8) NOT NULL DEFAULT '🎮',
	`preferredMinutes` int NOT NULL DEFAULT 10,
	`needsParentOk` boolean NOT NULL DEFAULT false,
	`notes` text,
	`active` boolean NOT NULL DEFAULT true,
	`rank` int NOT NULL DEFAULT 100,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gamePrefs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `moodSignals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` enum('skillPractice','placement','manual') NOT NULL DEFAULT 'skillPractice',
	`subjectSlug` varchar(32),
	`skillLadderId` int,
	`selfRating` int,
	`feltIt` enum('easy','ok','hard','skip'),
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `moodSignals_id` PRIMARY KEY(`id`)
);
