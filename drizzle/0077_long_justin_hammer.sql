CREATE TABLE `worksheetPdfCache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subjectSlug` varchar(40) NOT NULL,
	`topicKey` varchar(120) NOT NULL DEFAULT 'default',
	`contentVersion` int NOT NULL DEFAULT 1,
	`title` varchar(200) NOT NULL,
	`storageKey` varchar(300) NOT NULL,
	`url` varchar(400) NOT NULL,
	`source` enum('llm','fallback') NOT NULL DEFAULT 'fallback',
	`questionCount` int NOT NULL DEFAULT 0,
	`byteSize` int NOT NULL DEFAULT 0,
	`generatedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `worksheetPdfCache_id` PRIMARY KEY(`id`),
	CONSTRAINT `worksheet_pdf_subject_topic_version_uniq` UNIQUE(`subjectSlug`,`topicKey`,`contentVersion`)
);
