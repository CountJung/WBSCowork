"use client";

import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Alert, Chip, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
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

function calculateProjectSpanDays(startDate: Date, endDate: Date) {
  const daySpan = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  return Math.max(daySpan, 1);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createChartOptions(viewMode: ViewMode, taskCount: number): GanttOptions {
  return {
    view_mode: viewMode,
    view_mode_select: false,
    readonly: true,
    readonly_dates: true,
    readonly_progress: true,
    container_height: Math.max(560, taskCount * 54),
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const ganttRef = useRef<Gantt | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("Week");
  const [renderError, setRenderError] = useState<string | null>(null);
  const rootTaskCount = tasks.filter((task) => task.parentId === null).length;
  const assignedTaskCount = tasks.filter((task) => task.assigneeId !== null).length;
  const linkedTaskCount = tasks.filter((task) => task.parentId !== null).length;
  const projectSpanDays = calculateProjectSpanDays(project.startDate, project.endDate);

  const openTaskRoute = useEffectEvent((taskId: string) => {
    const taskElement = document.getElementById(`task-${taskId}`);

    if (pathname === "/tasks" && searchParams.get("projectId") === String(project.id) && searchParams.get("taskId") === taskId) {
      if (taskElement) {
        taskElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      return;
    }

    router.push(`/tasks?projectId=${project.id}&taskId=${taskId}`, { scroll: false });
  });

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
          ganttRef.current = new Gantt(container, chartTasks, {
            ...createChartOptions(viewMode, chartTasks.length),
            popup: ({ add_action, set_details, set_subtitle, set_title, task }) => {
              const ganttTask = task as WbsGanttTask;

              set_title(escapeHtml(ganttTask.name));
              set_subtitle(escapeHtml(ganttTask.description || "세부 설명이 아직 없습니다."));
              set_details(
                [
                  `<strong>기간</strong> ${escapeHtml(ganttTask.start)} ~ ${escapeHtml(ganttTask.end)}`,
                  `<strong>진행률</strong> ${ganttTask.progress ?? 0}%`,
                  `<strong>담당자</strong> ${escapeHtml(ganttTask.assigneeName || "미지정")}`,
                  `<strong>이동</strong> 아래 버튼으로 해당 업무 카드와 제출물 영역으로 바로 이동할 수 있습니다.`,
                ].join("<br />"),
              );
              add_action("업무 열기", (popupTask) => {
                openTaskRoute(String(popupTask.id));
              });
            },
          });
        } else {
          ganttRef.current.refresh(chartTasks);
          ganttRef.current.update_options({
            ...createChartOptions(viewMode, chartTasks.length),
            popup: ({ add_action, set_details, set_subtitle, set_title, task }) => {
              const ganttTask = task as WbsGanttTask;

              set_title(escapeHtml(ganttTask.name));
              set_subtitle(escapeHtml(ganttTask.description || "세부 설명이 아직 없습니다."));
              set_details(
                [
                  `<strong>기간</strong> ${escapeHtml(ganttTask.start)} ~ ${escapeHtml(ganttTask.end)}`,
                  `<strong>진행률</strong> ${ganttTask.progress ?? 0}%`,
                  `<strong>담당자</strong> ${escapeHtml(ganttTask.assigneeName || "미지정")}`,
                  `<strong>이동</strong> 아래 버튼으로 해당 업무 카드와 제출물 영역으로 바로 이동할 수 있습니다.`,
                ].join("<br />"),
              );
              add_action("업무 열기", (popupTask) => {
                openTaskRoute(String(popupTask.id));
              });
            },
          });
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
    <Paper
      elevation={0}
      sx={[
        {
          p: { xs: 3, md: 4 },
          borderRadius: 6,
          border: "1px solid",
          borderColor: "divider",
          background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(249,244,232,0.94) 52%, rgba(255,255,255,0.98) 100%)",
          boxShadow: "0 18px 40px rgba(20, 99, 86, 0.08)",
        },
        (theme) =>
          theme.applyStyles("dark", {
            background: "linear-gradient(180deg, rgba(22,33,29,0.98) 0%, rgba(15,24,21,0.96) 50%, rgba(18,31,27,0.99) 100%)",
            boxShadow: "0 22px 48px rgba(0, 0, 0, 0.28)",
          }),
      ]}
    >
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { lg: "flex-start" } }}>
          <Stack spacing={1.25}>
            <Typography variant="overline" color="primary.main" sx={{ letterSpacing: "0.14em", fontWeight: 700 }}>
              WBS 핵심 시각화
            </Typography>
            <Stack spacing={0.5}>
              <Typography variant="h4">{project.name} 간트 차트</Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 820 }}>
                이 프로젝트의 핵심 화면입니다. 전체 일정 길이, 상하위 작업 연결, 담당자 배치 상태를 한 번에 읽고 바로 세부 작업 카드로 이어서 확인할 수 있습니다.
              </Typography>
            </Stack>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} sx={{ flexWrap: "wrap" }}>
              <Chip label={`전체 기간 ${projectSpanDays}일`} color="primary" />
              <Chip label={`전체 작업 ${tasks.length}`} variant="outlined" />
              <Chip label={`루트 작업 ${rootTaskCount}`} variant="outlined" />
              <Chip label={`연결 작업 ${linkedTaskCount}`} variant="outlined" />
              <Chip label={`담당 배정 ${assignedTaskCount}`} variant="outlined" />
            </Stack>
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