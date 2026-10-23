export const reportMimeType = (format: "docx" | "pptx") => format === "docx"
  ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  : "application/vnd.openxmlformats-officedocument.presentationml.presentation";
