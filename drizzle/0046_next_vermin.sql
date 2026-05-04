CREATE TABLE `adultAiMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`actorOpenId` varchar(100),
	`actorName` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `adultAiMessages_id` PRIMARY KEY(`id`)
);
