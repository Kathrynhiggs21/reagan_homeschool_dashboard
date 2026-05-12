ALTER TABLE `drive_push_queue` MODIFY COLUMN `file_key` varchar(500);--> statement-breakpoint
ALTER TABLE `drive_push_queue` MODIFY COLUMN `file_url` varchar(500);--> statement-breakpoint
ALTER TABLE `drive_push_queue` MODIFY COLUMN `target_folder` enum('reagan','reagan_ihes','reagan_tutor','reagan_artwork','reagan_assignments','finished_work','daily_schedule','worksheets','printables','report_cards','journal','analytics','adult_notes','kiwi_coins','tutor','apps_tools','bookshelf','adventures','practice','notebook','curriculum_checklist','day_log','recap_reply','topics_covered','agenda_pdf') NOT NULL DEFAULT 'reagan';--> statement-breakpoint
ALTER TABLE `drive_push_queue` ADD `content_text` text;--> statement-breakpoint
ALTER TABLE `drive_push_queue` ADD `target_subpath` varchar(200);