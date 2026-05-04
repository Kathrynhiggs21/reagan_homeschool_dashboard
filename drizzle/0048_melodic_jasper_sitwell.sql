CREATE TABLE `tutorDayNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dateStr` varchar(10) NOT NULL,
	`tutorName` varchar(80) NOT NULL,
	`authorOpenId` varchar(64),
	`topicsCovered` text,
	`comfort` enum('calm','okay','stretched','overwhelmed'),
	`notes` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tutorDayNotes_id` PRIMARY KEY(`id`)
);
