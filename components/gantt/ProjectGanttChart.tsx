"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { Alert, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import Gantt from "frappe-gantt";
import type { Project } from "@/models/project";
import type { Task } from "@/models/task";

type ProjectGanttChartProps = {
  project: Project;
  tasks: Task[];
};

type ViewMode = "Day" | "Week" | "Month";

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

export default function ProjectGanttChart({ project, tasks }: ProjectGanttChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("Week");
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || tasks.length === 0) {
      return;
    }

    const chartTasks = tasks.map((task) => ({
      id: String(task.id),
      name: task.title,
      start: formatDate(task.startDate),
      end: formatDate(task.endDate),
      progress: calculateProgress(task.startDate, task.endDate),
      dependencies: task.parentId ? String(task.parentId) : "",
    }));

    containerRef.current.innerHTML = "";

    try {
      new Gantt(containerRef.current, chartTasks, {
        view_mode: viewMode,
        view_mode_select: false,
        readonly: true,
        readonly_dates: true,
        readonly_progress: true,
        container_height: 420,
        popup: ({ task }) => {
          return `
            <div class="details-container">
              <h5>${task.name}</h5>
              <p>${task.start} ~ ${task.end}</p>
              <p>진행률 ${task.progress}%</p>
            </div>
          `;
        },
      });
      startTransition(() => {
        setRenderError(null);
      });
    } catch (error) {
      startTransition(() => {
        setRenderError(error instanceof Error ? error.message : "간트 차트를 렌더링하지 못했습니다.");
      });
    }
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