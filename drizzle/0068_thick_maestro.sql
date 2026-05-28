CREATE TABLE `reviewAttempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`topicMasteryId` int NOT NULL,
	`sessionId` int,
	`attemptedAt` timestamp NOT NULL DEFAULT (now()),
	`score` int NOT NULL DEFAULT 0,
	`totalQuestions` int NOT NULL DEFAULT 0,
	`correctAnswers` int NOT NULL DEFAULT 0,
	`kiwiQuizLog` json,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reviewAttempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `topicMastery` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subjectSlug` varchar(64) NOT NULL,
	`topicHandle` varchar(128) NOT NULL,
	`topicTitle` varchar(255) NOT NULL,
	`gradeLevel` int NOT NULL DEFAULT 5,
	`masteryScore` int NOT NULL DEFAULT 50,
	`attemptCount` int NOT NULL DEFAULT 0,
	`lastReviewedAt` timestamp,
	`nextReviewAt` timestamp,
	`weakSpots` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `topicMastery_id` PRIMARY KEY(`id`)
);
