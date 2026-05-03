CREATE TABLE `curriculumResources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`topic_id` int NOT NULL,
	`kind` varchar(32) NOT NULL,
	`title` varchar(400) NOT NULL,
	`url` varchar(1024),
	`source` varchar(64),
	`notes` text,
	`added_by_user_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `curriculumResources_id` PRIMARY KEY(`id`)
);
