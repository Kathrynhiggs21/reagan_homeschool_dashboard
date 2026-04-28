CREATE TABLE `academicRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` enum('paste','manus_share','gmail','classroom','powerschool_ih','powerschool_madeira','ixl','drive','manual') NOT NULL,
	`kind` enum('assignment','grade','mastery','note','attendance') NOT NULL,
	`subjectSlug` varchar(32),
	`title` varchar(300) NOT NULL,
	`summary` text,
	`scoreText` varchar(48),
	`scorePercent` int,
	`assignedAt` timestamp,
	`dueAt` timestamp,
	`completedAt` timestamp,
	`payload` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `academicRecords_id` PRIMARY KEY(`id`)
);
