CREATE TABLE `bookPagesDone` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookId` int NOT NULL,
	`pageNumber` int NOT NULL,
	`status` enum('done','skipped') NOT NULL DEFAULT 'done',
	`source` enum('tutor_recon','agenda_complete','manual') NOT NULL DEFAULT 'manual',
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	`completedBy` varchar(100),
	`note` varchar(200),
	CONSTRAINT `bookPagesDone_id` PRIMARY KEY(`id`),
	CONSTRAINT `bookPagesDone_book_page_unique` UNIQUE(`bookId`,`pageNumber`)
);
--> statement-breakpoint
ALTER TABLE `books` MODIFY COLUMN `type` enum('workbook','novel','reference','audiobook','chapter_book') NOT NULL DEFAULT 'workbook';--> statement-breakpoint
ALTER TABLE `books` ADD `currentChapter` int;--> statement-breakpoint
ALTER TABLE `books` ADD `totalChapters` int;--> statement-breakpoint
ALTER TABLE `books` ADD `defaultDailyPageSpan` int DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `status` enum('not_started','in_progress','in_progress_unstructured','done','shelved') DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `topicCodes` json;