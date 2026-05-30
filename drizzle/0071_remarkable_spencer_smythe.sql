ALTER TABLE `drive_push_queue` ADD `content_hash` varchar(64);--> statement-breakpoint
ALTER TABLE `drive_push_queue` ADD `dedupe_outcome` enum('new','dup_pending','dup_pushed','dup_hash');--> statement-breakpoint
ALTER TABLE `icalFeeds` ADD `gcalEmbedUrl` text;