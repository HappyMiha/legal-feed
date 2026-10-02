CREATE TABLE `search_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`data` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `search_cache_expiry` ON `search_cache` (`expires_at`);