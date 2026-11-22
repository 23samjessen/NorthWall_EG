CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`sequence` integer NOT NULL,
	`timestamp` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_name` text NOT NULL,
	`action` text NOT NULL,
	`object_id` text NOT NULL,
	`request_id` text NOT NULL,
	`changes` text NOT NULL,
	`previous_hash` text NOT NULL,
	`hash` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audit_events_sequence_unique` ON `audit_events` (`sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `audit_events_hash_unique` ON `audit_events` (`hash`);--> statement-breakpoint
CREATE TABLE `workspace` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`revision` integer NOT NULL,
	`last_hash` text NOT NULL,
	`updated_at` text NOT NULL
);
