CREATE TABLE `auditLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorOpenId` varchar(64),
	`actorName` varchar(100),
	`entityType` varchar(32) NOT NULL,
	`entityId` int,
	`action` enum('create','update','delete','complete','reopen','grade','submit') NOT NULL,
	`summary` varchar(300),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLog_id` PRIMARY KEY(`id`)
);
