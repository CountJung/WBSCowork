"use client";

import { startTransition, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Alert, Chip, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import Gantt from "frappe-gantt";
import type { Project } from "@/src/entities/project";
import { taskStatusLabels, type Task } from "@/src/entities/task";
import type { GanttOptions, GanttTask } from "frappe-gantt";
import { summarizeTaskCompletion, type TaskCompletion } from "../model/task-completion";

type ProjectGanttChartProps = {
  project: Project;
  tasks: Task[];
};

type ViewMode = "Day" | "Week" | "Month";

type WbsGanttTask = GanttTask & {
  description: string;
  assigneeName: string;
  status: Task["status"];
  completion: TaskCompletion;
};

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
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

function createChartOptions(viewMode: ViewMode, taskCount: number, openTask: (taskId: string) => void): GanttOptions {
  return {
    view_mode: viewMode,
    view_mode_select: false,
    readonly: true,
    readonly_dates: true,
    readonly_progress: true,
    scroll_to: "today",
    container_height: Math.max(560, taskCount * 54),
    popup: ({ task, set_title, set_subtitle, set_details, add_action }) => {
      const ganttTask = task as WbsGanttTask;

      set_title(escapeHtml(ganttTask.name));
      set_subtitle(escapeHtml(ganttTask.description || "세부 설명이 아직 없습니다."));
      set_details(
        [
          `<strong>예정 기간</strong> ${escapeHtml(ganttTask.start)} ~ ${escapeHtml(ganttTask.end)}`,
          `<strong>업무 상태</strong> ${escapeHtml(taskStatusLabels[ganttTask.status])}`,
          `<strong>${ganttTask.completion.isContainer ? "하위 말단 업무 완료" : "업무 완료"}</strong> ${ganttTask.progress ?? 0}% (${ganttTask.completion.completedLeafCount}/${ganttTask.completion.leafCount}개)`,
          `<strong>담당자</strong> ${escapeHtml(ganttTask.assigneeName || "미지정")}`,
          `<strong>이동</strong> 아래 버튼으로 해당 업무 카드와 제출물 영역으로 바로 이동할 수 있습니다.`,
        ].join("<br />"),
      );
      add_action("업무 열기", (popupTask) => {
        openTask(String(popupTask.id));
      });
    },
  };
}

export default function ProjectGanttChart({ project, tasks }: ProjectGanttChartProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const ganttRef = useRef<Gantt | null>(null);
  const hasScrolledToToday = useRef(false);
  const [viewMode, setViewMode] = useState<ViewMode>("Week");
  const [renderError, setRenderError] = useState<string | null>(null);
  const rootTaskCount = tasks.filter((task) => task.parentId === null).length;
  const assignedTaskCount = tasks.filter((task) => task.assigneeId !== null).length;
  const childTaskCount = tasks.filter((task) => task.parentId !== null).length;
  const projectSpanDays = calculateProjectSpanDays(project.startDate, project.endDate);
  const completion = useMemo(() => summarizeTaskCompletion(tasks), [tasks]);

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

    // Reset today-scroll flag on every effect run (tasks or viewMode changed)
    hasScrolledToToday.current = false;

    const chartTasks: WbsGanttTask[] = tasks.map((task) => ({
      id: String(task.id),
      name: task.title,
      start: formatDate(task.startDate),
      end: formatDate(task.endDate),
      progress: completion.byTaskId.get(task.id)!.percent,
      dependencies: "",
      description: task.description,
      assigneeName: task.assigneeName ?? "미지정",
      status: task.status,
      completion: completion.byTaskId.get(task.id)!,
    }));
    const chartOptions = createChartOptions(viewMode, chartTasks.length, (taskId) => openTaskRoute(taskId));

    let frameId = 0;

    const syncChart = () => {
      try {
        if (!ganttRef.current) {
          container.innerHTML = "";
          ganttRef.current = new Gantt(container, chartTasks, chartOptions);
        } else {
          ganttRef.current.refresh(chartTasks);
          ganttRef.current.update_options(chartOptions);
          ganttRef.current.change_view_mode(viewMode, true);
        }

        startTransition(() => {
          setRenderError(null);
        });

        // Scroll to today on initial render using the .current-highlight element
        // frappe-gantt's internal scrollTo uses behavior:'smooth' (async), so we
        // manually set scrollLeft synchronously after layout via rAF.
        if (!hasScrolledToToday.current) {
          requestAnimationFrame(() => {
            const ganttContainer = container.querySelector(".gantt-container") as HTMLElement | null;
            const todayEl = container.querySelector(".current-highlight") as HTMLElement | null;
            if (ganttContainer && todayEl) {
              const left = parseFloat(todayEl.style.left) || 0;
              const containerWidth = ganttContainer.clientWidth;
              if (containerWidth > 0) {
                ganttContainer.scrollLeft = Math.max(0, left - containerWidth / 3);
                hasScrolledToToday.current = true;
              }
            }
          });
        }
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
  }, [tasks, viewMode, completion]);

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
                막대의 날짜는 예정 일정입니다. 완료율은 말단 업무 중 완료 상태인 업무의 비율이며, 상하위 구조는 업무 카드에서 확인할 수 있습니다.
              </Typography>
            </Stack>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} sx={{ flexWrap: "wrap" }}>
              <Chip label={`전체 기간 ${projectSpanDays}일`} color="primary" />
              <Chip label={`전체 작업 ${tasks.length}`} variant="outlined" />
              <Chip label={`말단 업무 완료 ${completion.completedLeafCount}/${completion.leafCount} (${completion.percent}%)`} color="success" variant="outlined" />
              <Chip label={`남은 말단 업무 ${completion.remainingLeafCount}`} variant="outlined" />
              <Chip label={`루트 작업 ${rootTaskCount}`} variant="outlined" />
              <Chip label={`하위 작업 ${childTaskCount}`} variant="outlined" />
              <Chip label={`담당 배정 ${assignedTaskCount}`} variant="outlined" />
            </Stack>
            <Stack spacing={0.75}>
              <Typography variant="body2" color="text.secondary">말단 업무 상태</Typography>
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
                {Object.entries(taskStatusLabels).map(([status, label]) => (
                  <Chip key={status} size="small" label={`${label} ${completion.statusCounts.get(status) ?? 0}`} variant="outlined" />
                ))}
              </Stack>
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
