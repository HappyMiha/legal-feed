CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`password_hash` text,
	`password_salt` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`data` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt` integer DEFAULT 0 NOT NULL,
	`provider_id` text,
	`error` text,
	`created_at` text NOT NULL,
	`sent_at` text,
	FOREIGN KEY (`owner_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `outbox_due` ON `outbox` (`status`,`next_attempt`);--> statement-breakpoint
CREATE INDEX `outbox_owner` ON `outbox` (`owner_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`data` text NOT NULL,
	`status` text NOT NULL,
	`next_run` integer DEFAULT 0 NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`lease_token` text,
	FOREIGN KEY (`owner_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `profiles_owner` ON `profiles` (`owner_id`);--> statement-breakpoint
CREATE INDEX `profiles_due` ON `profiles` (`status`,`next_run`);--> statement-breakpoint
CREATE TABLE `source_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`source_id` text NOT NULL,
	`checked_at` text NOT NULL,
	`status` text NOT NULL,
	`detail` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `checks_profile` ON `source_checks` (`profile_id`);--> statement-breakpoint
CREATE TABLE `updates` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`canonical_url` text NOT NULL,
	`data` text NOT NULL,
	`source_text` text NOT NULL,
	`discovered_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `updates_owner` ON `updates` (`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `updates_profile_url` ON `updates` (`profile_id`,`canonical_url`);