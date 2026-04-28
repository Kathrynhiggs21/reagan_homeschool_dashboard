CREATE TABLE `tagLinks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tagId` int NOT NULL,
	`entityType` enum('note','mood','block','day','journal','rescue','struggle') NOT NULL,
	`entityId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tagLinks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(48) NOT NULL,
	`label` varchar(80) NOT NULL,
	`emoji` varchar(12),
	`category` enum('mood','subject','energy','body','social','family','custom') NOT NULL DEFAULT 'custom',
	`color` enum('butter','coral','mint','sky','lavender','peach','pink','rose','sage') NOT NULL DEFAULT 'butter',
	`isPreset` boolean NOT NULL DEFAULT false,
	`sortOrder` int NOT NULL DEFAULT 100,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `tags_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `whiteboardNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`authorUserId` int NOT NULL,
	`authorName` varchar(80) NOT NULL,
	`authorAvatar` varchar(40),
	`title` varchar(120),
	`body` text NOT NULL,
	`color` enum('butter','coral','mint','sky','lavender','peach','pink') NOT NULL DEFAULT 'butter',
	`emoji` varchar(12),
	`pinned` boolean NOT NULL DEFAULT false,
	`showOnDate` date,
	`heartCount` int NOT NULL DEFAULT 0,
	`reaganHearted` boolean NOT NULL DEFAULT false,
	`archived` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whiteboardNotes_id` PRIMARY KEY(`id`)
);
