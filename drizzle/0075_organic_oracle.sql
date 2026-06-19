CREATE TABLE `youtubeInterests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`topic` varchar(64) NOT NULL,
	`label` varchar(96) NOT NULL,
	`weight` int NOT NULL DEFAULT 0,
	`hits` int NOT NULL DEFAULT 0,
	`source` enum('liked','subscription','playlist','watch_history','manual') NOT NULL,
	`samplesJson` json,
	`lastSeen` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `youtubeInterests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `youtubeSyncState` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lastSyncAt` timestamp,
	`lastSource` varchar(32),
	`lastItemCount` int NOT NULL DEFAULT 0,
	`lastError` text,
	`scheduleCronTaskUid` varchar(65),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `youtubeSyncState_id` PRIMARY KEY(`id`)
);
