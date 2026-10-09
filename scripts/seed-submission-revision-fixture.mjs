/** Repair only newly seeded raw SQL fixtures, never operating data. */
export async function seedSubmissionRevisionFixtures(db) {
  await db.prepare("INSERT INTO submission_revisions(submission_id,revision_number,editor_id,content,visibility,material_url,change_summary,file_path,file_name,file_mime_type,file_size_bytes,source) SELECT id,current_revision,NULL,content,visibility,material_url,'Synthetic legacy fixture',file_path,file_name,file_mime_type,file_size_bytes,'legacy' FROM submissions WHERE NOT EXISTS(SELECT 1 FROM submission_revisions r WHERE r.submission_id=submissions.id AND r.revision_number=submissions.current_revision)").run();
}
