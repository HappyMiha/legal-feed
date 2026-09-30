CREATE TABLE `ai_provider_state` (
	`id` text PRIMARY KEY NOT NULL,
	`next_request_at` integer DEFAULT 0 NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`lease_token` text,
	`failures` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `source_checks` ADD `next_run` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE source_checks SET next_run=CASE WHEN status='ok' THEN COALESCE(unixepoch(checked_at)*1000+3600000,0) ELSE 0 END;
--> statement-breakpoint
UPDATE profiles SET next_run=0 WHERE status='active';
