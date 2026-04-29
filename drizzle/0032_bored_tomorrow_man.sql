CREATE TABLE `powerschool_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`import_id` int,
	`course` varchar(256) NOT NULL,
	`category` varchar(128),
	`title` varchar(512) NOT NULL,
	`due_date` varchar(32),
	`assigned_date` varchar(32),
	`score` varchar(64),
	`points_possible` varchar(64),
	`status` varchar(32),
	`teacher_comment` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `powerschool_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `powerschool_grades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`import_id` int,
	`term` varchar(32) NOT NULL,
	`course` varchar(256) NOT NULL,
	`teacher` varchar(256),
	`letter` varchar(8),
	`percent` varchar(16),
	`comments` text,
	`snapshot_date` varchar(32),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `powerschool_grades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `powerschool_imports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` varchar(32) NOT NULL DEFAULT 'paste',
	`raw_body` text NOT NULL,
	`raw_mime` varchar(128) DEFAULT 'text/plain',
	`parsed_count` int NOT NULL DEFAULT 0,
	`error_count` int NOT NULL DEFAULT 0,
	`notes` text,
	`imported_by` varchar(256),
	`imported_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `powerschool_imports_id` PRIMARY KEY(`id`)
);
