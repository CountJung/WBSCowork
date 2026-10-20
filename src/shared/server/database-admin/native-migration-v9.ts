import { nativeMigrationV1 } from "./native-migration-v1";
const newTables = [`CREATE TABLE IF NOT EXISTS bug_report_screenshots (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 report_id BIGINT NOT NULL,
 ordinal INT NOT NULL,
 file_path VARCHAR(512) NOT NULL UNIQUE,
 file_name VARCHAR(255) NOT NULL,
 file_mime_type VARCHAR(32) NOT NULL,
 file_size_bytes BIGINT NOT NULL,
 content_hash CHAR(64) NOT NULL,
 UNIQUE KEY bug_screenshot_ordinal_unique (report_id,ordinal),
 CONSTRAINT bug_screenshot_report_fk FOREIGN KEY (report_id) REFERENCES bug_reports(id) ON DELETE CASCADE,
 CONSTRAINT bug_screenshot_ordinal_check CHECK(ordinal BETWEEN 0 AND 2),
 CONSTRAINT bug_screenshot_size_check CHECK(file_size_bytes BETWEEN 1 AND 2097152),
 CONSTRAINT bug_screenshot_type_check CHECK(file_mime_type IN ('image/png','image/jpeg','image/webp'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`];
export const nativeMigrationV9 = {version:9,name:"bug_report_screenshots",verifierVersion:1,
 additions:[{table:"bug_reports",name:"creation_fingerprint",definition:"creation_fingerprint VARCHAR(64) NOT NULL DEFAULT ''"}],
 newTables, statements:[...newTables, ...nativeMigrationV1.statements.filter(s=>s.startsWith("CREATE TABLE IF NOT EXISTS bug_reports ")).map(s=>s.replace("title VARCHAR", "creation_fingerprint VARCHAR(64) NOT NULL DEFAULT '', title VARCHAR"))],
} as const;
