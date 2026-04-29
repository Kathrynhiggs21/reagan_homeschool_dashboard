ALTER TABLE `sync_run_items` ADD `dismissed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `sync_run_items` ADD `flagged` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `sync_run_items` ADD `parent_note` varchar(500);