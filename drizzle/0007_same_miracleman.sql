CREATE TABLE `feed_limit_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`requested_limit` integer NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` text NOT NULL,
	`approved_limit` integer,
	`decided_at` text,
	`decision_nonce` text,
	`mail_payload` text NOT NULL,
	`mail_status` text DEFAULT 'pending' NOT NULL,
	`mail_attempts` integer DEFAULT 0 NOT NULL,
	`mail_next_attempt` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feed_limit_token` ON `feed_limit_requests` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `feed_limit_pending_owner` ON `feed_limit_requests` (`owner_id`) WHERE "feed_limit_requests"."status"='pending';--> statement-breakpoint
CREATE INDEX `feed_limit_owner` ON `feed_limit_requests` (`owner_id`);--> statement-breakpoint
ALTER TABLE `accounts` ADD `feed_limit` integer DEFAULT 3 NOT NULL;