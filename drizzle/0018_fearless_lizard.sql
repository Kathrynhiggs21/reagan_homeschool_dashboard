CREATE TABLE `placementResponses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`placementTaskId` int NOT NULL,
	`skillLadderId` int NOT NULL,
	`kidAnswer` text,
	`isCorrect` boolean,
	`feltIt` enum('easy','ok','hard','skip') NOT NULL DEFAULT 'ok',
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `placementResponses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `placementTasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`skillLadderId` int NOT NULL,
	`taskOrder` int NOT NULL DEFAULT 0,
	`gradeLevel` varchar(8) NOT NULL DEFAULT '5',
	`taskType` enum('pickOne','trueFalse','shortAnswer','showMeHow') NOT NULL DEFAULT 'pickOne',
	`kidPrompt` text NOT NULL,
	`choices` json,
	`correctAnswer` text,
	`hint` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `placementTasks_id` PRIMARY KEY(`id`)
);
