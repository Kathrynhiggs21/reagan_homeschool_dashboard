CREATE TABLE `skillFeedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`skillLadderId` int,
	`subjectSlug` varchar(32),
	`feltIt` enum('easy','ok','hard','skip'),
	`whatHelped` enum('story','visual','handsOn','watch','practice','kiwiTalk','tutor','movement','none'),
	`timeFelt` enum('tooShort','justRight','tooLong'),
	`wantedBreak` boolean NOT NULL DEFAULT false,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `skillFeedback_id` PRIMARY KEY(`id`)
);
