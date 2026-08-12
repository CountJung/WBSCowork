"use client";

import { useEffect } from "react";

type TaskFocusControllerProps = {
  taskId: number | null;
};

export default function TaskFocusController({ taskId }: TaskFocusControllerProps) {
  useEffect(() => {
    if (!taskId) {
      return;
    }

    let cancelled = false;
    let frameId = 0;
    let nestedFrameId = 0;
    let timeoutId = 0;
    let attempts = 0;

    const focusTaskCard = () => {
      if (cancelled) {
        return;
      }

      const taskElement = document.getElementById(`task-${taskId}`);

      if (taskElement) {
        taskElement.scrollIntoView({ behavior: "smooth", block: "start" });

        return;
      }

      if (attempts >= 6) {
        return;
      }

      attempts += 1;
      timeoutId = window.setTimeout(focusTaskCard, 120);
    };

    frameId = window.requestAnimationFrame(() => {
      nestedFrameId = window.requestAnimationFrame(focusTaskCard);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      window.cancelAnimationFrame(nestedFrameId);
      window.clearTimeout(timeoutId);
    };
  }, [taskId]);

  return null;
}