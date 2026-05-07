CREATE TABLE `dayAttachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dateStr` varchar(10) NOT NULL,
	`kind` enum('image','pdf') NOT NULL,
	`fileKey` varchar(240) NOT NULL,
	`fileName` varchar(200),
	`markupKey` varchar(240),
	`pageIndex` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dayAttachments_id` PRIMARY KEY(`id`)
);
