CREATE TABLE `academicSourceRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` varchar(40) NOT NULL,
	`status` varchar(24) NOT NULL,
	`summary` varchar(400),
	`itemsFound` int DEFAULT 0,
	`itemsInserted` int DEFAULT 0,
	`errorText` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	CONSTRAINT `academicSourceRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `classroomAgendas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agendaDate` varchar(10) NOT NULL,
	`teacher` varchar(100),
	`course` varchar(120),
	`subjectSlug` varchar(32),
	`school` varchar(60),
	`term` varchar(8),
	`source` varchar(40) NOT NULL,
	`sourceUrl` varchar(600),
	`imageKey` varchar(200),
	`rawText` text,
	`topics` json,
	`assignments` json,
	`standalonePdfKey` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `classroomAgendas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `iepAccommodations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`iepDate` varchar(10),
	`category` varchar(40) NOT NULL,
	`accommodationText` text NOT NULL,
	`subjectSlug` varchar(32),
	`frequency` varchar(60),
	`notes` text,
	`active` boolean NOT NULL DEFAULT true,
	`sourceFileKey` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `iepAccommodations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `iepGoals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`iepDate` varchar(10),
	`reviewDate` varchar(10),
	`area` varchar(40) NOT NULL,
	`subjectSlug` varchar(32),
	`goalText` text NOT NULL,
	`presentLevel` text,
	`measuredBy` varchar(200),
	`targetCriterion` varchar(200),
	`startPercent` int,
	`targetPercent` int,
	`currentPercent` int,
	`status` varchar(24) DEFAULT 'in_progress',
	`quarterlyProgress` json,
	`sourceFileKey` varchar(200),
	`sourceFileName` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `iepGoals_id` PRIMARY KEY(`id`)
);
