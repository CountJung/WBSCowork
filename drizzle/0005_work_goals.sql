ALTER TABLE `projects` ADD `goal` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `success_criteria` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `deliverable` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `definition_of_done` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `review_required` integer DEFAULT 0 NOT NULL;