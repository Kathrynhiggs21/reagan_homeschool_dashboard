CREATE TABLE `sync_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` varchar(16) NOT NULL,
	`lookback_days` int NOT NULL DEFAULT 2,
	`requested_at` timestamp NOT NULL DEFAULT (now()),
	`consumed_at` timestamp,
	CONSTRAINT `sync_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sync_run_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`run_id` int NOT NULL,
	`source` varchar(16) NOT NULL,
	`external_id` varchar(255) NOT NULL,
	`routed_to` varchar(32) NOT NULL,
	`record_id` int NOT NULL,
	`title` varchar(255),
	`message` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sync_run_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` varchar(16) NOT NULL,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`finished_at` timestamp,
	`items_scanned` int NOT NULL DEFAULT 0,
	`items_routed` int NOT NULL DEFAULT 0,
	`items_skipped` int NOT NULL DEFAULT 0,
	`errors` text,
	`triggered_by` varchar(16) NOT NULL DEFAULT 'schedule',
	CONSTRAINT `sync_runs_id` PRIMARY KEY(`id`)
);
