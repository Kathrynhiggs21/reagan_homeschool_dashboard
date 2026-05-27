CREATE TABLE `notebookPages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dateStr` varchar(10) NOT NULL,
	`pageIndex` int NOT NULL DEFAULT 0,
	`paperStyle` varchar(32) NOT NULL DEFAULT 'lined',
	`textContent` longtext,
	`drawingStrokes` longtext,
	`penColor` varchar(16),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notebookPages_id` PRIMARY KEY(`id`)
);
