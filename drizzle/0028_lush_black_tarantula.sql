ALTER TABLE `learnerProfile` ADD `birthday` varchar(10);--> statement-breakpoint
ALTER TABLE `learnerProfile` ADD `pronouns` varchar(32);--> statement-breakpoint
ALTER TABLE `learnerProfile` ADD `selfStatement` text;--> statement-breakpoint
ALTER TABLE `learnerProfile` ADD `selfAdvocacyStatement` text;--> statement-breakpoint
ALTER TABLE `learnerProfile` ADD `schoolHistory` json;--> statement-breakpoint
ALTER TABLE `learnerProfile` ADD `family` json;--> statement-breakpoint
ALTER TABLE `learnerProfile` ADD `pets` json;--> statement-breakpoint
ALTER TABLE `learnerProfile` ADD `sensoryLoves` json;--> statement-breakpoint
ALTER TABLE `learnerProfile` ADD `sensoryAvoids` json;--> statement-breakpoint
ALTER TABLE `learnerProfile` ADD `favoriteFoods` json;--> statement-breakpoint
ALTER TABLE `learnerProfile` ADD `favoriteShows` json;--> statement-breakpoint
ALTER TABLE `learnerProfile` ADD `favoriteBooks` json;--> statement-breakpoint
ALTER TABLE `learnerProfile` ADD `diagnoses` json;--> statement-breakpoint
ALTER TABLE `learnerProfile` ADD `currentSupports` json;