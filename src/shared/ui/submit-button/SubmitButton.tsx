"use client";

import { Button, type ButtonProps } from "@mui/material";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = Omit<
  ButtonProps,
  "component" | "href" | "type" | "loading" | "loadingIndicator" | "loadingPosition"
> & {
  pendingLabel: string;
  pending?: boolean;
};

// Keep this component inside its native form so only that action controls pending.
export default function SubmitButton({
  children,
  disabled = false,
  pendingLabel,
  pending: controlledPending = false,
  ...props
}: SubmitButtonProps) {
  const status = useFormStatus();
  const pending = status.pending || controlledPending;

  return (
    <Button
      {...props}
      type="submit"
      disabled={disabled || pending}
      loading={pending}
      loadingPosition="start"
      aria-busy={pending}
    >
      <span aria-live="polite" aria-atomic="true">
        {pending ? pendingLabel : children}
      </span>
    </Button>
  );
}
