"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { Alert, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import Gantt from "frappe-gantt";
import type { Project } from "@/models/project";
import type { Task } from "@/models/task";
import type { GanttOptions, GanttTask } from "frappe-gantt";

type ProjectGanttChartProps = {
  project: Project;
  tasks: Task[];
};

type ViewMode = "Day" | "Week" | "Month";

type WbsGanttTask = GanttTask & {
  description: string;
  assigneeName: string;
};

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function calculateProgress(startDate: Date, endDate: Date) {
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();

  if (endTime <= startTime) {
    return 100;
  }

  const progress = ((Date.now() - startTime) / (endTime - startTime)) * 100;

  return Math.max(0, Math.min(100, Math.round(progress)));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createChartOptions(viewMode: ViewMode): GanttOptions {
  return {
    view_mode: viewMode,
    view_mode_select: false,
    readonly: true,
    readonly_dates: true,
    readonly_progress: true,
    container_height: "auto",
    popup: ({ task, set_title, set_subtitle, set_details }) => {
      const ganttTask = task as WbsGanttTask;

      set_title(escapeHtml(ganttTask.name));
      set_subtitle(escapeHtml(ganttTask.description || "세부 설명이 아직 없습니다."));
      set_details(
        [
          `<strong>기간</strong> ${escapeHtml(ganttTask.start)} ~ ${escapeHtml(ganttTask.end)}`,
          `<strong>진행률</strong> ${ganttTask.progress ?? 0}%`,
          `<strong>담당자</strong> ${escapeHtml(ganttTask.assigneeName || "미지정")}`,
        ].join("<br />"),
      );
    },
  };
}

export default function ProjectGanttChart({ project, tasks }: ProjectGanttChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const ganttRef = useRef<Gantt | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("Week");
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    if (tasks.length === 0) {
      container.innerHTML = "";
      ganttRef.current = null;
      return;
    }

    const chartTasks: WbsGanttTask[] = tasks.map((task) => ({
      id: String(task.id),
      name: task.title,
      start: formatDate(task.startDate),
      end: formatDate(task.endDate),
      progress: calculateProgress(task.startDate, task.endDate),
      dependencies: task.parentId ? String(task.parentId) : "",
      description: task.description,
      assigneeName: task.assigneeName ?? "미지정",
    }));

    let frameId = 0;

    const syncChart = () => {
      try {
        if (!ganttRef.current) {
          container.innerHTML = "";
          ganttRef.current = new Gantt(container, chartTasks, createChartOptions(viewMode));
        } else {
          ganttRef.current.refresh(chartTasks);
          ganttRef.current.update_options(createChartOptions(viewMode));
          ganttRef.current.change_view_mode(viewMode, true);
        }

        startTransition(() => {
          setRenderError(null);
        });
      } catch (error) {
        startTransition(() => {
          setRenderError(error instanceof Error ? error.message : "간트 차트를 렌더링하지 못했습니다.");
        });
      }
    };

    const scheduleSync = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(syncChart);
    };

    syncChart();

    const resizeObserver = new ResizeObserver(() => {
      scheduleSync();
    });
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          scheduleSync();
        }
      },
      { threshold: 0.05 },
    );

    resizeObserver.observe(container);
    intersectionObserver.observe(container);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, [tasks, viewMode]);

  if (tasks.length === 0) {
    return (
      <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
        <Typography variant="body2" color="text.secondary">
          간트 차트를 표시할 작업이 아직 없습니다.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} sx={{ justifyContent: "space-between" }}>
          <Stack spacing={0.5}>
            <Typography variant="h5">{project.name} 간트 차트</Typography>
            <Typography variant="body2" color="text.secondary">
              Stage 4 구현입니다. 프로젝트 작업의 일정과 부모-자식 흐름을 시간축으로 시각화합니다.
            </Typography>
          </Stack>
          <ToggleButtonGroup
            exclusive
            size="small"
            color="primary"
            value={viewMode}
            onChange={(_event, value: ViewMode | null) => {
              if (value) {
                setViewMode(value);
              }
            }}
          >
            <ToggleButton value="Day">Day</ToggleButton>
            <ToggleButton value="Week">Week</ToggleButton>
            <ToggleButton value="Month">Month</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        {renderError ? <Alert severity="error">{renderError}</Alert> : null}

        <div ref={containerRef} className="wbs-gantt-surface" />
      </Stack>
    </Paper>
  );
}