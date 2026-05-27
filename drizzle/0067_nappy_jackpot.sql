CREATE TABLE `flashcardCards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deckId` int NOT NULL,
	`front` text NOT NULL,
	`back` text NOT NULL,
	`hint` text,
	`imageUrl` varchar(512),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `flashcardCards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `flashcardDecks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`subjectSlug` varchar(64) NOT NULL,
	`topicHandle` varchar(128),
	`gradeLevel` int NOT NULL DEFAULT 5,
	`description` text,
	`cardCount` int NOT NULL DEFAULT 0,
	`isAiGenerated` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `flashcardDecks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviewQuestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`questionType` enum('multiple-choice','short-answer','flashcard','ck12-practice') NOT NULL DEFAULT 'multiple-choice',
	`question` text NOT NULL,
	`correctAnswer` text NOT NULL,
	`choices` json,
	`studentAnswer` text,
	`isCorrect` boolean,
	`timeSpentMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reviewQuestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviewSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dateStr` varchar(10) NOT NULL,
	`subjectSlug` varchar(64) NOT NULL,
	`topicHandle` varchar(128),
	`topicTitle` varchar(255),
	`score` int,
	`totalQuestions` int NOT NULL DEFAULT 0,
	`correctAnswers` int NOT NULL DEFAULT 0,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reviewSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weakTopics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subjectSlug` varchar(64) NOT NULL,
	`topicHandle` varchar(128) NOT NULL,
	`topicTitle` varchar(255) NOT NULL,
	`masteryScore` int NOT NULL DEFAULT 50,
	`reviewCount` int NOT NULL DEFAULT 0,
	`lastReviewedAt` timestamp,
	`ck12Url` varchar(512),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `weakTopics_id` PRIMARY KEY(`id`)
);
