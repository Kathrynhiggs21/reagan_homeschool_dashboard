CREATE TABLE `appSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(64) NOT NULL,
	`value` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `appSettings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `certificates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`slug` varchar(64) NOT NULL,
	`title` varchar(120) NOT NULL,
	`emoji` varchar(8),
	`description` text,
	`issuedOn` date NOT NULL,
	`issuedByUserId` int,
	`imageUrl` varchar(500),
	`custom` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `certificates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coinLedger` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`delta` int NOT NULL,
	`kind` enum('earn_sticker','earn_bonus','earn_gold_star','spend_prize','adjust') NOT NULL,
	`reasonNote` varchar(200),
	`stickerId` int,
	`prizeRedemptionId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coinLedger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `goodWorkNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`authorUserId` int,
	`authorName` varchar(100),
	`lyric` text NOT NULL,
	`attachedToStickerId` int,
	`attachedToSubmissionId` int,
	`attachedToBlockId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `goodWorkNotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `placementResults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`subjectSlug` varchar(32) NOT NULL,
	`gradeEquivalent` varchar(16),
	`strengthsNote` text,
	`gapsNote` text,
	`assessedAt` timestamp NOT NULL DEFAULT (now()),
	`assessedByUserId` int,
	`sourceKind` enum('self_check','tutor','parent','map','acadience','review_library') NOT NULL DEFAULT 'self_check',
	CONSTRAINT `placementResults_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prizeRedemptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`prizeId` int NOT NULL,
	`coinCost` int NOT NULL,
	`status` enum('pending','approved','delivered','denied') NOT NULL DEFAULT 'pending',
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`approvedByUserId` int,
	`approvedAt` timestamp,
	`deliveredAt` timestamp,
	`notes` text,
	CONSTRAINT `prizeRedemptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prizes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(64) NOT NULL,
	`title` varchar(120) NOT NULL,
	`emoji` varchar(8) NOT NULL,
	`description` text,
	`coinCost` int NOT NULL,
	`category` enum('cash','digital','toy','experience','screen_time','treat','custom') NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`stock` int,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prizes_id` PRIMARY KEY(`id`),
	CONSTRAINT `prizes_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `reviewResources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`topic` varchar(120) NOT NULL,
	`subjectSlug` varchar(32),
	`gradeBand` varchar(16),
	`kind` enum('youtube','webpage','app','printable','practice','game') NOT NULL,
	`title` varchar(200) NOT NULL,
	`url` varchar(500),
	`youtubeId` varchar(32),
	`description` text,
	`approved` boolean NOT NULL DEFAULT true,
	`addedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reviewResources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stickers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`awardedAt` timestamp NOT NULL DEFAULT (now()),
	`reason` enum('block_done','streak_bonus','gold_star_day','submission_approved','placement_complete','adult_bonus') NOT NULL,
	`blockId` int,
	`submissionId` int,
	`art` varchar(64) NOT NULL,
	`palette` varchar(32),
	`coinsAwarded` int NOT NULL DEFAULT 1,
	`shortLyric` varchar(200),
	`addedByUserId` int,
	CONSTRAINT `stickers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tutorSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tutorId` int NOT NULL,
	`scheduledAt` timestamp NOT NULL,
	`durationMin` int NOT NULL DEFAULT 60,
	`location` varchar(200),
	`focus` text,
	`status` enum('scheduled','completed','missed','trial','cancelled') NOT NULL DEFAULT 'scheduled',
	`sessionNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tutorSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tutors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`role` varchar(60),
	`email` varchar(200),
	`phone` varchar(40),
	`bio` text,
	`subjects` varchar(300),
	`avatarUrl` varchar(500),
	`active` boolean NOT NULL DEFAULT true,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tutors_id` PRIMARY KEY(`id`)
);
