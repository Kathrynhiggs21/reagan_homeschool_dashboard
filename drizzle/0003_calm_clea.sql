CREATE TABLE `adventures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text NOT NULL,
	`subjectSlugs` json NOT NULL,
	`topicTags` json NOT NULL,
	`interestTags` json NOT NULL,
	`minDurationMin` int NOT NULL DEFAULT 30,
	`maxDurationMin` int NOT NULL DEFAULT 90,
	`setting` enum('indoor','outdoor','either') NOT NULL DEFAULT 'either',
	`energyLevel` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`materials` json NOT NULL,
	`instructions` text NOT NULL,
	`ohioStandards` json,
	`isFavorite` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `adventures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `animals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`species` varchar(100) NOT NULL,
	`notes` text,
	`photoUrl` varchar(1000),
	`dateAdded` date,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `animals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `appLinks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`url` varchar(500) NOT NULL,
	`category` enum('learning','creativity','school','nature','reading') NOT NULL DEFAULT 'learning',
	`emoji` varchar(8) NOT NULL,
	`description` text,
	`accountInfo` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `appLinks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`contactName` varchar(100),
	`recurrenceRule` varchar(100),
	`startTime` varchar(8),
	`endTime` varchar(8),
	`leaveTime` varchar(8),
	`returnTime` varchar(8),
	`durationMin` int NOT NULL DEFAULT 60,
	`isProtected` boolean NOT NULL DEFAULT true,
	`decompressionBufferMin` int NOT NULL DEFAULT 30,
	`notes` text,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `appointments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `badges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(64) NOT NULL,
	`name` varchar(100) NOT NULL,
	`emoji` varchar(8) NOT NULL,
	`description` text NOT NULL,
	`criteria` text NOT NULL,
	`earned` boolean NOT NULL DEFAULT false,
	`earnedAt` timestamp,
	`progress` int NOT NULL DEFAULT 0,
	`target` int NOT NULL DEFAULT 1,
	CONSTRAINT `badges_id` PRIMARY KEY(`id`),
	CONSTRAINT `badges_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `bookAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blockId` int NOT NULL,
	`bookId` int NOT NULL,
	`fromPage` int NOT NULL,
	`toPage` int NOT NULL,
	`notes` text,
	`status` enum('assigned','complete') NOT NULL DEFAULT 'assigned',
	CONSTRAINT `bookAssignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `books` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`author` varchar(200),
	`type` enum('workbook','novel','reference','audiobook') NOT NULL DEFAULT 'workbook',
	`subjectSlug` varchar(32),
	`currentPage` int NOT NULL DEFAULT 1,
	`totalPages` int,
	`notes` text,
	CONSTRAINT `books_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dailyPlans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` date NOT NULL,
	`dayType` enum('full','half','outdoor','field_trip','recovery','off') NOT NULL DEFAULT 'full',
	`status` enum('planned','in_progress','complete','skipped') NOT NULL DEFAULT 'planned',
	`notes` text,
	`isTemplate` boolean NOT NULL DEFAULT false,
	`templateName` varchar(128),
	`parentPlanId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dailyPlans_id` PRIMARY KEY(`id`),
	CONSTRAINT `dailyPlans_date_unique` UNIQUE(`date`)
);
--> statement-breakpoint
CREATE TABLE `emotionalStruggles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int,
	`blockId` int,
	`subjectSlug` varchar(32),
	`topicTag` varchar(100),
	`intensity` enum('green','yellow','red') NOT NULL,
	`description` text,
	`triggers` json,
	`copingUsed` json,
	`resolved` boolean NOT NULL DEFAULT false,
	`loggedByUserId` int,
	`loggedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `emotionalStruggles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `encouragementNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fromName` varchar(100) NOT NULL,
	`fromUserId` int,
	`content` text NOT NULL,
	`starred` boolean NOT NULL DEFAULT false,
	`read` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `encouragementNotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `heartNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`content` text NOT NULL,
	`whisperResponse` text,
	`sharedWithMom` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `heartNotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ihAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceTeacher` varchar(100) NOT NULL,
	`sourceClass` varchar(100) NOT NULL,
	`title` varchar(300) NOT NULL,
	`description` text,
	`postedAt` timestamp,
	`dueDate` date,
	`url` varchar(1000),
	`raw` json,
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ihAssignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `learnerProfile` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentName` varchar(100) NOT NULL DEFAULT 'Reagan',
	`gradeLevel` varchar(32) NOT NULL DEFAULT '5th Grade',
	`accommodations` json,
	`triggers` json,
	`whatWorks` json,
	`whatHarms` json,
	`contacts` json,
	`interests` json,
	`notes` text,
	CONSTRAINT `learnerProfile_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `moodLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`zone` enum('green','yellow','red') NOT NULL,
	`note` text,
	`loggedByUserId` int,
	`loggedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `moodLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notificationRecipients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`displayName` varchar(100),
	`role` enum('parent','grandparent','tutor','other') NOT NULL DEFAULT 'other',
	`optInTypes` json,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `notificationRecipients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`type` enum('red_zone','block_complete','milestone','ih_update','reminder','info') NOT NULL,
	`title` varchar(200) NOT NULL,
	`body` text,
	`link` varchar(500),
	`read` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rescues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100),
	`species` varchar(100) NOT NULL,
	`dateFound` date NOT NULL,
	`location` varchar(200),
	`condition` text,
	`carePlan` text,
	`outcome` enum('in_care','released','transferred','passed','adopted') NOT NULL DEFAULT 'in_care',
	`releaseDate` date,
	`photoUrl` varchar(1000),
	`notes` text,
	`loggedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rescues_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduleBlocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`blockType` enum('morning_warmup','math','adventure','read_aloud','choice','catch_up','appointment','custom') NOT NULL,
	`subjectId` int,
	`title` varchar(200) NOT NULL,
	`description` text,
	`durationMin` int NOT NULL DEFAULT 30,
	`startTime` varchar(8),
	`sortOrder` int NOT NULL DEFAULT 0,
	`status` enum('not_started','in_progress','complete','skipped') NOT NULL DEFAULT 'not_started',
	`completedAt` timestamp,
	`completedByUserId` int,
	`grade` varchar(16),
	`notes` text,
	`ihAssignmentId` int,
	`adventureId` int,
	`appointmentId` int,
	CONSTRAINT `scheduleBlocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schoolCalendar` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` date NOT NULL,
	`isOff` boolean NOT NULL DEFAULT true,
	`label` varchar(200) NOT NULL,
	`source` varchar(100) DEFAULT 'Indian Hill 2025-26',
	CONSTRAINT `schoolCalendar_id` PRIMARY KEY(`id`),
	CONSTRAINT `schoolCalendar_date_unique` UNIQUE(`date`)
);
--> statement-breakpoint
CREATE TABLE `skillsMastery` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subjectSlug` varchar(32) NOT NULL,
	`skillName` varchar(200) NOT NULL,
	`domain` varchar(100),
	`currentScore` int NOT NULL DEFAULT 0,
	`lastPracticedAt` timestamp,
	`needsHelp` boolean NOT NULL DEFAULT false,
	`sourceData` json,
	`notes` text,
	CONSTRAINT `skillsMastery_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `specialDays` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` date NOT NULL,
	`name` varchar(200) NOT NULL,
	`category` enum('astronomy','nature','animal','plant','seasonal','spiritual','service','quirky','art') NOT NULL,
	`description` text NOT NULL,
	`suggestedActivity` text,
	`interestTags` json,
	`viewingTimeNote` varchar(200),
	`isOptional` boolean NOT NULL DEFAULT true,
	CONSTRAINT `specialDays_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(32) NOT NULL,
	`name` varchar(64) NOT NULL,
	`color` varchar(16) NOT NULL,
	`emoji` varchar(8) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `subjects_id` PRIMARY KEY(`id`),
	CONSTRAINT `subjects_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `timelineEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` date NOT NULL,
	`eventType` enum('completion','milestone','creation','field_trip','reflection','adventure') NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`subjectSlug` varchar(32),
	`mediaUrl` varchar(1000),
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `timelineEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weeklyTopics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`weekStartDate` date NOT NULL,
	`subjectSlug` varchar(32) NOT NULL,
	`topics` json NOT NULL,
	`notes` text,
	CONSTRAINT `weeklyTopics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whisperSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`blockId` int,
	`mode` enum('text','voice') NOT NULL DEFAULT 'text',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whisperSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','tutor','admin') NOT NULL DEFAULT 'user';