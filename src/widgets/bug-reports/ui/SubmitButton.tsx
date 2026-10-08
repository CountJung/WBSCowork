"use client";
import { Button } from "@mui/material";
import { useFormStatus } from "react-dom";
export default function SubmitButton({
  children,
}: {
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="contained" disabled={pending}>
      {pending ? "저장 중…" : children}
    </Button>
  );
}
