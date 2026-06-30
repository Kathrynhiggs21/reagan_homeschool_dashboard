CREATE TABLE `ixlDiagnosticLevels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subjectSlug` varchar(32) NOT NULL,
	`strandKey` varchar(80) NOT NULL DEFAULT 'overall',
	`strandLabel` varchar(160) NOT NULL,
	`ixlScore` int,
	`gradeEquivalent` varchar(16),
	`measuredAt` timestamp NOT NULL DEFAULT (now()),
	`recordedByUserId` int,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ixlDiagnosticLevels_id` PRIMARY KEY(`id`),
	CONSTRAINT `ixl_diag_subject_strand_uniq` UNIQUE(`subjectSlug`,`strandKey`)
);
--> statement-breakpoint
ALTER TABLE `placementResults` MODIFY COLUMN `sourceKind` enum('self_check','tutor','parent','map','acadience','review_library','ixl_diagnostic') NOT NULL DEFAULT 'self_check';