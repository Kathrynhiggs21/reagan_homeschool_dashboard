CREATE TABLE `icalEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`feedId` int NOT NULL,
	`uid` varchar(200) NOT NULL,
	`summary` varchar(240) NOT NULL,
	`location` varchar(200),
	`description` text,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp,
	`allDay` boolean NOT NULL DEFAULT false,
	`forDate` varchar(10) NOT NULL,
	`rawSnippet` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `icalEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `icalFeeds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`label` varchar(120) NOT NULL,
	`url` text NOT NULL,
	`color` varchar(16) NOT NULL DEFAULT '#0a66c2',
	`enabled` boolean NOT NULL DEFAULT true,
	`lastSyncedAt` timestamp,
	`lastSyncStatus` enum('never','ok','failed') NOT NULL DEFAULT 'never',
	`lastSyncError` text,
	`eventsCached` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `icalFeeds_id` PRIMARY KEY(`id`)
);
