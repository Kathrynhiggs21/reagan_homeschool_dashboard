CREATE TABLE `assignmentAnswerKeys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blockId` int NOT NULL,
	`questions` json NOT NULL,
	`totalPoints` int NOT NULL DEFAULT 100,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assignmentAnswerKeys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `assignmentSubmissionsAutoGrade` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submissionId` int NOT NULL,
	`autoScore` int,
	`autoLetter` varchar(2),
	`autoFeedback` text,
	`answers` json,
	`gradedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assignmentSubmissionsAutoGrade_id` PRIMARY KEY(`id`),
	CONSTRAINT `assignmentSubmissionsAutoGrade_submissionId_unique` UNIQUE(`submissionId`)
);
--> statement-breakpoint
CREATE TABLE `blockGrades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blockId` int NOT NULL,
	`subjectSlug` varchar(32),
	`score` int NOT NULL,
	`letter` varchar(2),
	`kidLabel` enum('not_yet','getting_there','got_it','mastered') NOT NULL DEFAULT 'got_it',
	`note` text,
	`gradedAt` timestamp NOT NULL DEFAULT (now()),
	`gradedByUserId` int,
	CONSTRAINT `blockGrades_id` PRIMARY KEY(`id`),
	CONSTRAINT `blockGrades_blockId_unique` UNIQUE(`blockId`)
);
--> statement-breakpoint
CREATE TABLE `curriculumAdjustments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subjectSlug` varchar(32) NOT NULL,
	`weekStart` date NOT NULL,
	`suggestion` text NOT NULL,
	`reason` text,
	`affectsTopicId` int,
	`status` enum('proposed','accepted','rejected','applied') NOT NULL DEFAULT 'proposed',
	`proposedAt` timestamp NOT NULL DEFAULT (now()),
	`decidedAt` timestamp,
	`decidedByUserId` int,
	CONSTRAINT `curriculumAdjustments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `needsWorkItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parentId` int,
	`subjectSlug` varchar(32),
	`title` varchar(300) NOT NULL,
	`note` text,
	`origin` enum('manual','mastery','struggle','low_grade','external') NOT NULL DEFAULT 'manual',
	`sortOrder` int NOT NULL DEFAULT 0,
	`dateAdded` date NOT NULL,
	`dateCompleted` date,
	`completedByUserId` int,
	CONSTRAINT `needsWorkItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `printableFavorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceId` int NOT NULL,
	`title` varchar(300) NOT NULL,
	`url` varchar(1000) NOT NULL,
	`subjectSlug` varchar(32),
	`note` text,
	`savedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `printableFavorites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `printableSources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`url` varchar(500) NOT NULL,
	`searchUrl` varchar(500),
	`description` text,
	`subjects` json,
	`grades` json,
	`tags` json,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	CONSTRAINT `printableSources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `takeNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subjectSlug` varchar(32),
	`title` varchar(200),
	`body` text,
	`strokes` json,
	`pngFileKey` varchar(500),
	`pngFileUrl` varchar(1000),
	`tags` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `takeNotes_id` PRIMARY KEY(`id`)
);
