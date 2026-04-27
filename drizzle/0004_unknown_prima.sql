CREATE TABLE `reaganKnowledge` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` enum('gmail','gdrive','manual','chat_history') NOT NULL,
	`sourceTitle` varchar(500),
	`sourceUrl` varchar(1000),
	`sourceDate` date,
	`insightType` enum('academic_strength','academic_gap','trigger','accommodation','interest','medical','social','preference','quote','strategy','context','general') NOT NULL,
	`insight` text NOT NULL,
	`confidence` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`active` boolean NOT NULL DEFAULT true,
	`sensitive` boolean NOT NULL DEFAULT false,
	`approvedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reaganKnowledge_id` PRIMARY KEY(`id`)
);
