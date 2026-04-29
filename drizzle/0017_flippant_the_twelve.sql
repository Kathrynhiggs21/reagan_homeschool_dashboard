CREATE TABLE `proudMoments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` enum('reagan','kiwi','parent','tutor','auto') NOT NULL DEFAULT 'kiwi',
	`category` enum('effort','kindness','skill','bravery','creativity','persistence','growth','wonder') NOT NULL DEFAULT 'effort',
	`title` varchar(200) NOT NULL,
	`body` text,
	`emoji` varchar(12) NOT NULL DEFAULT '⭐',
	`skillLadderId` int,
	`blockId` int,
	`reaganHearted` boolean NOT NULL DEFAULT false,
	`archived` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `proudMoments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `skillLadder` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subjectSlug` varchar(32) NOT NULL,
	`strand` varchar(64) NOT NULL,
	`skillCode` varchar(32) NOT NULL,
	`title` varchar(240) NOT NULL,
	`kidFriendly` text,
	`gradeLevel` varchar(8) NOT NULL DEFAULT '5',
	`ladderOrder` int NOT NULL,
	`prereqSkillCodes` json,
	`estMinutes` int NOT NULL DEFAULT 15,
	`khanUrl` varchar(600),
	`ixlUrl` varchar(600),
	`watchUrl` varchar(600),
	`storyHook` text,
	`visualHook` text,
	`handsOnHook` text,
	`ihAligned` boolean NOT NULL DEFAULT true,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `skillLadder_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `skillProgress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`skillLadderId` int NOT NULL,
	`level` int NOT NULL DEFAULT 0,
	`confidence` int NOT NULL DEFAULT 0,
	`evidenceCount` int NOT NULL DEFAULT 0,
	`lastPracticedAt` timestamp,
	`lastModeUsed` enum('story','visual','handsOn','watch','practice') NOT NULL DEFAULT 'practice',
	`parentNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `skillProgress_id` PRIMARY KEY(`id`)
);
