CREATE TABLE `dailyAgendas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(10) NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`lastEmailedAt` timestamp,
	`lastChangeAt` timestamp NOT NULL DEFAULT (now()),
	`pdfStorageKey` varchar(512),
	`pdfUrl` varchar(512),
	`driveFileId` varchar(128),
	`version` int NOT NULL DEFAULT 1,
	`notes` text,
	CONSTRAINT `dailyAgendas_id` PRIMARY KEY(`id`),
	CONSTRAINT `dailyAgendas_date_unique` UNIQUE(`date`)
);
--> statement-breakpoint
CREATE TABLE `listeningSummaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(10) NOT NULL,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`subjectGuess` varchar(32),
	`topicsJson` json,
	`completionsJson` json,
	`emotionScore` int,
	`comfortScore` int,
	`difficultyScore` int,
	`talkativenessScore` int,
	`rawSummary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `listeningSummaries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `studentRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fromUserId` int,
	`kind` enum('assignment','adventure','schedule','snack','supplies','help','other') NOT NULL DEFAULT 'other',
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	`resolvedNote` text,
	`resolvedByUserId` int,
	CONSTRAINT `studentRequests_id` PRIMARY KEY(`id`)
);
