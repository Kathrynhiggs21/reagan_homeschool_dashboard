CREATE TABLE `classroomCourses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(64) NOT NULL,
	`name` varchar(256) NOT NULL,
	`section` varchar(128),
	`description` text,
	`room` varchar(64),
	`ownerName` varchar(128),
	`enrollmentCode` varchar(32),
	`courseState` varchar(32),
	`alternateLink` text,
	`subjectId` int,
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `classroomCourses_id` PRIMARY KEY(`id`),
	CONSTRAINT `classroomCourses_externalId_unique` UNIQUE(`externalId`)
);
--> statement-breakpoint
CREATE TABLE `classroomSubmissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentId` int NOT NULL,
	`fromStatus` enum('to_do','in_progress','turned_in','graded'),
	`toStatus` enum('to_do','in_progress','turned_in','graded') NOT NULL,
	`changedBy` varchar(64),
	`note` text,
	`driveFileId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `classroomSubmissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `drive_push_queue` MODIFY COLUMN `target_folder` enum('reagan','reagan_ihes','reagan_tutor','reagan_artwork','reagan_assignments','finished_work','daily_schedule','worksheets','printables','report_cards','journal','analytics','adult_notes','kiwi_coins','tutor','apps_tools','bookshelf','adventures','practice','notebook','curriculum_checklist','day_log','recap_reply','topics_covered','agenda_pdf','classes') NOT NULL DEFAULT 'reagan';--> statement-breakpoint
ALTER TABLE `classroomAssignments` ADD `lifecycleStatus` enum('to_do','in_progress','turned_in','graded') DEFAULT 'to_do' NOT NULL;--> statement-breakpoint
ALTER TABLE `classroomAssignments` ADD `subjectId` int;--> statement-breakpoint
ALTER TABLE `classroomAssignments` ADD `startedAt` timestamp;--> statement-breakpoint
ALTER TABLE `classroomAssignments` ADD `turnedInAt` timestamp;--> statement-breakpoint
ALTER TABLE `classroomAssignments` ADD `gradedAt` timestamp;--> statement-breakpoint
ALTER TABLE `classroomAssignments` ADD `grade` varchar(32);--> statement-breakpoint
ALTER TABLE `classroomAssignments` ADD `gradeNumeric` decimal(6,2);--> statement-breakpoint
ALTER TABLE `classroomAssignments` ADD `driveFolderId` varchar(64);--> statement-breakpoint
ALTER TABLE `subjects` ADD `isCorePlanning` boolean DEFAULT true NOT NULL;