CREATE TABLE `curriculumTopics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subject` varchar(64) NOT NULL,
	`code` varchar(48) NOT NULL,
	`title` varchar(512) NOT NULL,
	`standard_ref` varchar(128),
	`parent_id` int,
	`ord` int NOT NULL DEFAULT 0,
	`status` varchar(16) NOT NULL DEFAULT 'notStarted',
	`completed_at` timestamp,
	`quarter` varchar(8),
	`notes` text,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `curriculumTopics_id` PRIMARY KEY(`id`)
);
