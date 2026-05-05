ALTER TABLE `listeningSummaries` ADD `relevanceScore` int;--> statement-breakpoint
ALTER TABLE `listeningSummaries` ADD `discardedReason` enum('background_noise','other_person','silence','non_school','too_short');--> statement-breakpoint
ALTER TABLE `listeningSummaries` ADD `schoolBlockId` int;