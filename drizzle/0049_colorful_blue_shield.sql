CREATE TABLE `nightlyAgendaEmails` (
	`id` int AUTO_INCREMENT NOT NULL,
	`forDate` varchar(10) NOT NULL,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`recipients` text NOT NULL,
	`agendaHash` varchar(64) NOT NULL,
	`blockCount` int NOT NULL,
	`pdfStorageKey` varchar(200),
	`drivePushed` boolean NOT NULL DEFAULT false,
	`driveFolderPath` varchar(200),
	`status` enum('queued','sent','failed','resent') NOT NULL DEFAULT 'queued',
	`errorMessage` text,
	`triggerKind` enum('nightly','change_resend','manual') NOT NULL DEFAULT 'nightly',
	CONSTRAINT `nightlyAgendaEmails_id` PRIMARY KEY(`id`)
);
