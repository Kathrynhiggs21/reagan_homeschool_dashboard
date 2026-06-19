ALTER TABLE `adventures` ADD `kind` enum('module','day_trip','reward','craft','brain_break','infrastructure','general') DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE `adventures` ADD `category` varchar(80);--> statement-breakpoint
ALTER TABLE `adventures` ADD `wishlistStatus` enum('idea','want_to_do','done') DEFAULT 'idea' NOT NULL;