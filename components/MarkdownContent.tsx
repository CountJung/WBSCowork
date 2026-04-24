"use client";

import { Box } from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownContent({ content }: { content: string }) {
  return (
    <Box
      sx={[
        {
          color: "text.primary",
          "& p": { my: 0.75 },
          "& ul, & ol": { pl: 3, my: 0.75 },
          "& pre": {
            overflowX: "auto",
            p: 1.5,
            borderRadius: 2,
            bgcolor: "rgba(17, 24, 39, 0.08)",
          },
          "& code": {
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          },
        },
        (theme) =>
          theme.applyStyles("dark", {
            "& pre": {
              bgcolor: "rgba(7, 13, 11, 0.72)",
            },
          }),
      ]}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </Box>
  );
}
