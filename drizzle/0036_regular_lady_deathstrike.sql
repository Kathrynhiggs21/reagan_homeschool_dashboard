CREATE TABLE `classroomAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(128) NOT NULL,
	`courseId` varchar(64) NOT NULL,
	`courseName` varchar(256),
	`title` varchar(512) NOT NULL,
	`description` text,
	`workType` varchar(32),
	`state` varchar(32),
	`link` text,
	`dueAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `classroomAssignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `classroomAssignments_externalId_unique` UNIQUE(`externalId`)
);
