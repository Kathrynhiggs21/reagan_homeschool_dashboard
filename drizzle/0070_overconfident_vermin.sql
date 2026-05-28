CREATE TABLE `appLaunches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appLinkId` int NOT NULL,
	`appName` varchar(100) NOT NULL,
	`category` varchar(50),
	`launchedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `appLaunches_id` PRIMARY KEY(`id`)
);
