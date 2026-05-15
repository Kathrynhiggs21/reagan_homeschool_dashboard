CREATE TABLE `kiwiVoiceAuditEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`timestamp_utc_ms` bigint NOT NULL,
	`original_candidate` text NOT NULL,
	`final_text` text NOT NULL,
	`severity` enum('info','minor','major') NOT NULL,
	`actions_json` text NOT NULL,
	`source_panel` varchar(64),
	CONSTRAINT `kiwiVoiceAuditEntries_id` PRIMARY KEY(`id`)
);
