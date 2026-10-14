CREATE TABLE `practice_attempts` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`puzzle_id` text NOT NULL,
	`data` text NOT NULL,
	`completed_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`)
);
