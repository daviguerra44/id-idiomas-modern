CREATE TABLE `myid_legacy_session` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`sealed` text NOT NULL,
	`expires_at` integer NOT NULL,
	`locked_until` integer DEFAULT 0 NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`retry_at` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
