"use client";

import { useEffect } from "react";

type TaskFocusControllerProps = {
  taskId: number | null;
  submissionId?:number|null;
};

export default function TaskFocusController({ taskId,submissionId }: TaskFocusControllerProps) {
  useEffect(() => {
    const targetId=submissionId?`submission-${submissionId}`:taskId?`task-${taskId}`:/^#task-\d+$/.test(window.location.hash)?window.location.hash.slice(1):null;
    if (!targetId) return;

    let cancelled = false;
    let frameId = 0;
    let nestedFrameId = 0;
    let timeoutId = 0;
    let attempts = 0;

    const focusTaskCard = () => {
      if (cancelled) {
        return;
      }

      const taskElement = document.getElementById(targetId);

      if (taskElement) {
        taskElement.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth", block: "start" });
        taskElement.focus({preventScroll:true});

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
  }, [taskId,submissionId]);

  return null;
}