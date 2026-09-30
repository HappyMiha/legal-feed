ALTER TABLE `source_checks` ADD `analysis_attempts` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE source_checks SET status='retrying',detail='Analysis format updated. Automatic retry scheduled.',next_run=0
WHERE status='error' AND detail IN ('Analysis returned an invalid result. Please retry.','Analysis did not complete. This source will be checked again.','Analysis returned invalid source references; retry required.');
--> statement-breakpoint
UPDATE profiles SET next_run=0 WHERE status='active' AND id IN (SELECT profile_id FROM source_checks WHERE status='retrying' AND next_run=0);
