CREATE TABLE `weekly_digests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`week_start` timestamp NOT NULL,
	`week_end` timestamp NOT NULL,
	`payload` json NOT NULL,
	`emailed_at` timestamp,
	`email_status` enum('pending','sent','failed') DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `weekly_digests_id` PRIMARY KEY(`id`)
);
