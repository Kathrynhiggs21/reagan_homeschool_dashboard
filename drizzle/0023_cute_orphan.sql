CREATE TABLE `tutorSessionSkills` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`skillLadderId` int NOT NULL,
	`outcome` enum('strong','gettingIt','needsMore','notWorked') NOT NULL DEFAULT 'gettingIt',
	`tutorNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tutorSessionSkills_id` PRIMARY KEY(`id`)
);
