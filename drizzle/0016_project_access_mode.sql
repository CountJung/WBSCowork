ALTER TABLE `projects` ADD `access_mode` text DEFAULT 'legacy_authenticated' NOT NULL CONSTRAINT project_access_mode_check CHECK(access_mode IN ('legacy_authenticated','members_only'));
