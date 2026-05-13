CREATE TABLE `kidRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`from_user_id` int,
	`body` text NOT NULL,
	`kind` enum('general','schedule','stuck','feeling') NOT NULL DEFAULT 'general',
	`created_at` bigint NOT NULL,
	`resolved_at` bigint,
	`resolved_by_user_id` int,
	`resolved_note` text,
	`emailed_to` varchar(480),
	`notify_owner_ok` boolean NOT NULL DEFAULT false,
	CONSTRAINT `kidRequests_id` PRIMARY KEY(`id`)
);
