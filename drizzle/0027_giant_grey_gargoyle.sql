CREATE TABLE `drive_push_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`file_key` varchar(500) NOT NULL,
	`file_url` varchar(500) NOT NULL,
	`file_name` varchar(300) NOT NULL,
	`mime_type` varchar(100),
	`target_folder` enum('reagan','reagan_ihes','reagan_tutor','reagan_artwork','reagan_assignments') NOT NULL DEFAULT 'reagan',
	`status` enum('pending','pushed','skipped','failed') NOT NULL DEFAULT 'pending',
	`drive_file_id` varchar(200),
	`error_message` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`pushed_at` timestamp,
	CONSTRAINT `drive_push_queue_id` PRIMARY KEY(`id`)
);
