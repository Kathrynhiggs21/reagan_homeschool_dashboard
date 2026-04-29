CREATE TABLE `assessmentScreenings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`testFamily` varchar(40) NOT NULL,
	`metric` varchar(60) NOT NULL,
	`windowLabel` varchar(40),
	`value` varchar(60) NOT NULL,
	`targetValue` varchar(60),
	`notes` text,
	`sourceDoc` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assessmentScreenings_id` PRIMARY KEY(`id`)
);
