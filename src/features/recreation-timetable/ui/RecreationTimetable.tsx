"use client";

import { useId, useState } from "react";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, TextField, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type { RecreationPreparationEntry, TimetableEvent } from "@/src/entities/team-preparation";
import { buildRecreationTimetable, initialTimetableDate, isTimetableDate, shiftTimetableDate, timetableDates } from "@/src/entities/team-preparation";

type View = "day" | "week";
type Props = { entries: RecreationPreparationEntry[]; today: string; draft?: boolean };
const minuteHeight = 1.2;
const statuses = { planned: "예정", in_progress: "진행", done: "완료" };
function clock(minute: number) { return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`; }
function duration(entry: RecreationPreparationEntry) {
  return Number.isFinite(entry.durationMinutes) && entry.durationMinutes > 0 ? `${entry.durationMinutes}분` : entry.durationMinutes === 0 ? "종료 시각 미정 · 0분 입력" : "소요 시간 입력 확인 필요";
}
function weekday(date: string) { return ["일", "월", "화", "수", "목", "금", "토"][new Date(`${date}T00:00:00.000Z`).getUTCDay()]; }
function eventPeriod(event: TimetableEvent) { return event.entry.durationMinutes === 0 ? `${clock(event.startMinute)} · 종료 미정 (0분)` : `${clock(event.startMinute)}~${clock(event.endMinute)}`; }
function fullPeriod(entry: RecreationPreparationEntry) {
  if (entry.time.length !== 5 || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(entry.time)) return "시작 시각 미지정·확인 필요";
  if (!Number.isInteger(entry.durationMinutes) || entry.durationMinutes < 0 || entry.durationMinutes > 1440) return `${entry.time} · 소요 시간 입력 확인 필요`;
  if (entry.durationMinutes === 0) return `${entry.time} · 종료 미정 (0분 입력)`;
  const end = Number(entry.time.slice(0, 2)) * 60 + Number(entry.time.slice(3)) + entry.durationMinutes;
  return `${entry.time} ~ ${end >= 1440 ? "다음날 " : ""}${clock(end % 1440)}`;
}
function title(entry: RecreationPreparationEntry) { return entry.title.trim() || "프로그램 제목 미입력"; }

/** Read-only projection of the existing preparation document. It never saves or moves entries. */
export function RecreationTimetable({ entries, today, draft = false }: Props) {
  const id = useId(), theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up("md"), { defaultMatches: false });
  const [viewOverride, setViewOverride] = useState<View | null>(null);
  const view = viewOverride ?? (wide ? "week" : "day");
  const [anchor, setAnchor] = useState(() => initialTimetableDate(entries, today));
  const [dateInput, setDateInput] = useState(anchor);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = entries.find(entry => entry.id === selectedId) ?? null;
  const dates = timetableDates(anchor, view);
  const model = buildRecreationTimetable(entries, dates);
  const hours: number[] = [];
  for (let minute = Math.ceil(model.startMinute / 60) * 60; minute <= Math.min(model.endMinute, 1440); minute += 60) hours.push(minute);
  const height = Math.max(72, (model.endMinute - model.startMinute) * minuteHeight);
  const maxLanes = Math.max(1, ...model.days.flatMap(day => day.events.map(event => event.lanes)));
  const columnWidth = Math.max(view === "day" ? 220 : 180, maxLanes * 140);
  const visibleIds = new Set(model.days.flatMap(day => [...day.events.map(event => event.entry.id), ...day.unscheduled.map(entry => entry.id)]));
  const outsideCount = entries.filter(entry => isTimetableDate(entry.date) && !visibleIds.has(entry.id)).length;
  const firstDate = initialTimetableDate(entries, today);
  const previous = shiftTimetableDate(anchor, view === "day" ? -1 : -7), next = shiftTimetableDate(anchor, view === "day" ? 1 : 7);
  const invalidDateInput = !isTimetableDate(dateInput);
  function move(date: string) { setAnchor(date); setDateInput(date); }
  function openEntry(entry: RecreationPreparationEntry) { setSelectedId(entry.id); }
  const period = dates.length > 1 ? `${dates[0]} ~ ${dates.at(-1)}` : dates[0];
  return <Stack spacing={2} data-testid="recreation-timetable" sx={{ minWidth: 0, maxWidth: "100%", overflowWrap: "anywhere", "& .MuiButton-root": { minHeight: 44, whiteSpace: "normal", maxWidth: "100%" }, "& .MuiChip-root": { maxWidth: "100%", height: "auto" }, "& .MuiChip-label": { whiteSpace: "normal", py: 0.5 }, "& summary": { minHeight: 44, py: 1, cursor: "pointer" } }}>
    <Stack spacing={1}><Typography component="h2" variant="h6" id={`${id}-heading`}>프로그램 시간표{draft ? " · 저장 전 미리보기" : ""}</Typography><Typography variant="body2" color="text.secondary">일정은 읽기 전용입니다. 변경은 기존 준비표 편집에서 저장하세요. 짧은 일정은 읽기 편하도록 높이를 넓혀 표시하며, 실제 소요 시간은 각 일정의 숫자로 확인합니다. 일정을 선택하면 전체 제목·준비물·메모를 볼 수 있습니다.</Typography></Stack>
    {draft ? <Alert severity="info">현재 입력 중인 초안입니다. 아래 준비표를 저장하기 전까지 다른 사람에게 반영되지 않습니다. 날짜·시각이 비어 있거나 올바르지 않은 항목은 별도로 표시합니다.</Alert> : null}
    <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: "wrap" }} aria-label="시간표 보기 방식"><Button type="button" variant={view === "day" ? "contained" : "outlined"} aria-pressed={view === "day"} onClick={() => setViewOverride("day")}>하루 보기</Button><Button type="button" variant={view === "week" ? "contained" : "outlined"} aria-pressed={view === "week"} onClick={() => setViewOverride("week")}>주간 보기</Button></Stack>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: { sm: "flex-start" } }}>
      <TextField type="date" label="시간표 기준 날짜" value={dateInput} error={invalidDateInput} helperText={invalidDateInput ? "실제로 존재하는 날짜를 선택하세요." : "주간 보기는 월요일부터 표시합니다."} onChange={event => { const value = event.target.value; setDateInput(value); if (isTimetableDate(value)) setAnchor(value); }} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: "0001-01-01", max: "9999-12-31" } }} sx={{ minWidth: 0, width: { xs: "100%", sm: 220 } }} />
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}><Button type="button" disabled={previous === anchor} onClick={() => move(previous)} aria-label={`이전 ${view === "day" ? "날" : "주"}`}>이전</Button><Button type="button" disabled={!isTimetableDate(today)} onClick={() => move(today)}>오늘</Button><Button type="button" disabled={next === anchor} onClick={() => move(next)} aria-label={`다음 ${view === "day" ? "날" : "주"}`}>다음</Button><Button type="button" disabled={firstDate === anchor || !entries.length} onClick={() => move(firstDate)}>첫 일정</Button></Stack>
    </Stack>
    <Typography role="status" variant="body2">{period} · 선택한 기간 {visibleIds.size}개{outsideCount ? ` · 다른 날짜 ${outsideCount}개` : ""}</Typography>
    {!entries.length ? <Alert severity="info">등록된 프로그램이 없습니다. 준비표 편집에서 날짜·제목·시작 시각을 입력하면 시간표에 표시됩니다.</Alert> : !visibleIds.size ? <Alert severity="info">선택한 기간에 표시할 일정이 없습니다. 날짜를 바꾸거나 ‘첫 일정’을 선택하세요.</Alert> : null}
    <Typography id={`${id}-scroll-hint`} variant="body2" color="text.secondary">시간표 영역 안에서 위아래로 이동할 수 있습니다. 주간 보기나 겹치는 일정이 많을 때에는 이 영역 안에서 좌우로도 이동하세요. 아래 전체 일정 목록으로도 확인할 수 있습니다.</Typography>
    {model.days.some(day => day.events.length > 0) ? <Box role="region" aria-labelledby={`${id}-heading`} aria-describedby={`${id}-scroll-hint`} tabIndex={0} sx={{ minWidth: 0, maxWidth: "100%", maxHeight: 720, overflow: "auto", overscrollBehavior: "contain", border: "1px solid", borderColor: "divider", borderRadius: 1, "&:focus-visible": { outline: "3px solid", outlineColor: "primary.main", outlineOffset: 2 } }}>
      <Box sx={{ display: "grid", gridTemplateColumns: `56px repeat(${model.days.length}, minmax(${columnWidth}px, 1fr))`, minWidth: 56 + model.days.length * columnWidth }}>
        <Box sx={{ position: "sticky", left: 0, top: 0, zIndex: 5, bgcolor: "background.paper", p: 1, borderBottom: "1px solid", borderColor: "divider" }}><Typography variant="caption">시간</Typography></Box>
        {model.days.map(day => <Box key={`header-${day.date}`} sx={{ position: "sticky", top: 0, zIndex: 3, bgcolor: "background.paper", p: 1, borderBottom: "1px solid", borderLeft: "1px solid", borderColor: "divider" }}><Typography variant="subtitle2">{day.date} ({weekday(day.date)}){day.date === today ? " · 오늘" : ""}</Typography><Typography variant="caption">{day.events.length}개{day.unscheduled.length ? ` · 시각 미지정 ${day.unscheduled.length}개` : ""}</Typography></Box>)}
        <Box aria-hidden="true" sx={{ position: "sticky", left: 0, zIndex: 2, height, bgcolor: "background.paper", borderRight: "1px solid", borderColor: "divider" }}>{hours.map(minute => <Typography key={minute} variant="caption" sx={{ position: "absolute", top: Math.max(0, (minute - model.startMinute) * minuteHeight - 8), left: 4 }}>{clock(minute)}</Typography>)}</Box>
        {model.days.map(day => <Box key={day.date} sx={{ position: "relative", height, borderRight: "1px solid", borderColor: "divider", bgcolor: "background.default" }}>
          {hours.map(minute => <Box aria-hidden="true" key={minute} sx={{ position: "absolute", top: (minute - model.startMinute) * minuteHeight, left: 0, right: 0, borderTop: "1px solid", borderColor: "divider" }} />)}
          {day.events.map(event => <Box component="button" type="button" key={event.key} onClick={() => openEntry(event.entry)} title={title(event.entry)} aria-label={`${event.date} ${eventPeriod(event)} ${title(event.entry)}, ${duration(event.entry)}${event.overlaps ? ", 다른 일정과 시간 겹침" : ""}${event.continuesBefore ? ", 전날부터 이어짐" : ""}${event.continuesAfter ? ", 다음날까지 이어짐" : ""}. 상세 보기`} sx={{ position: "absolute", top: (event.startMinute - model.startMinute) * minuteHeight, left: `calc(${event.lane * 100 / event.lanes}% + 2px)`, width: `calc(${100 / event.lanes}% - 4px)`, height: Math.max(44, (event.visualEndMinute - event.startMinute) * minuteHeight - 2), minWidth: 0, p: 0.75, m: 0, display: "grid", alignContent: "start", gap: 0.25, textAlign: "left", font: "inherit", color: "text.primary", bgcolor: "background.paper", border: "1px solid", borderColor: event.overlaps ? "warning.main" : "primary.main", borderLeftWidth: 4, borderRadius: 1, overflow: "hidden", cursor: "pointer", "&:hover": { bgcolor: "action.hover" }, "&:focus-visible": { outline: "3px solid", outlineColor: "primary.main", outlineOffset: -3, zIndex: 4 } }}>
            <Typography component="span" variant="caption" sx={{ display: "block", fontSize: "0.75rem", lineHeight: 1.2, fontWeight: 700, whiteSpace: "nowrap" }}>{eventPeriod(event)}</Typography><Typography component="span" variant="body2" sx={{ display: "block", fontSize: "0.875rem", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title(event.entry)}</Typography><Typography component="span" variant="caption" sx={{ display: "block", fontSize: "0.75rem", lineHeight: 1.2, whiteSpace: "nowrap" }}>{statuses[event.entry.status]}{event.overlaps ? " · 겹침" : ""}{event.continuesBefore ? " · 전날 연결" : ""}{event.continuesAfter ? " · 익일 연결" : ""} · 상세</Typography>
          </Box>)}
        </Box>)}
      </Box>
    </Box> : null}
    {model.days.filter(day => day.unscheduled.length).map(day => <Paper key={`unscheduled-${day.date}`} variant="outlined" sx={{ p: 2, minWidth: 0 }}><Typography component="h3" variant="subtitle1">{day.date} · 시작 시각 미지정·확인 필요 {day.unscheduled.length}개</Typography><Stack spacing={1}>{day.unscheduled.map((entry, index) => <Button key={`${entry.id}-${index}`} type="button" onClick={() => openEntry(entry)} sx={{ justifyContent: "flex-start", textAlign: "left", overflowWrap: "anywhere" }}>{title(entry)} · 상세 보기</Button>)}</Stack></Paper>)}
    {model.invalidDateEntries.length ? <Alert severity="warning"><Typography>날짜 입력 확인 필요 {model.invalidDateEntries.length}개 · 시간표 위치를 정할 수 없습니다.</Typography>{model.invalidDateEntries.map((entry, index) => <Button key={`${entry.id}-${index}`} type="button" onClick={() => openEntry(entry)} sx={{ textAlign: "left", overflowWrap: "anywhere" }}>{title(entry)} · 상세 보기</Button>)}</Alert> : null}
    <Box component="details"><Box component="summary">선택한 기간 전체 일정 목록 · {visibleIds.size}개</Box><Stack spacing={2} sx={{ pt: 1 }}>{model.days.map(day => <Stack key={`list-${day.date}`} spacing={1}><Typography component="h3" variant="subtitle1">{day.date}</Typography>{!day.events.length && !day.unscheduled.length ? <Typography variant="body2">일정이 없습니다.</Typography> : null}{day.events.map(event => <Button key={`list-${event.key}`} type="button" variant="outlined" onClick={() => openEntry(event.entry)} sx={{ justifyContent: "flex-start", textAlign: "left", overflowWrap: "anywhere" }}>{eventPeriod(event)}{event.continuesBefore ? " · 전날부터 이어짐" : ""} · {title(event.entry)} · {duration(event.entry)}{event.overlaps ? " · 시간 겹침" : ""}{event.continuesAfter ? " · 다음날까지" : ""}</Button>)}{day.unscheduled.map((entry, index) => <Button key={`list-${entry.id}-${index}`} type="button" variant="outlined" onClick={() => openEntry(entry)} sx={{ justifyContent: "flex-start", textAlign: "left", overflowWrap: "anywhere" }}>시각 미지정·확인 필요 · {title(entry)}</Button>)}</Stack>)}</Stack></Box>
    <Dialog open={selected !== null} onClose={() => setSelectedId(null)} fullWidth maxWidth="sm" scroll="paper" aria-labelledby={`${id}-detail-title`} aria-describedby={`${id}-detail-description`}>
      <DialogTitle id={`${id}-detail-title`} sx={{ overflowWrap: "anywhere" }}>{selected ? title(selected) : "프로그램 상세"}</DialogTitle><DialogContent dividers sx={{ minWidth: 0, overflowWrap: "anywhere" }}><Typography id={`${id}-detail-description`} variant="body2" sx={{ mb: 2 }}>읽기 전용 상세입니다. 수정하려면 준비표 편집을 이용하세요.</Typography>{selected ? <Stack spacing={1.5}><Typography>날짜: {selected.date || "미입력"}</Typography><Typography>시작·종료: {fullPeriod(selected)}</Typography><Typography>소요: {duration(selected)}</Typography><Typography>프로그램 순서: {Number.isFinite(selected.order) ? selected.order : "입력 확인 필요"}</Typography><Chip size="small" label={statuses[selected.status] ?? "상태 입력 확인 필요"} sx={{ alignSelf: "flex-start" }} />{selected.materials ? <Typography sx={{ whiteSpace: "pre-wrap" }}>준비물: {selected.materials}</Typography> : null}{selected.notes ? <Typography sx={{ whiteSpace: "pre-wrap" }}>메모: {selected.notes}</Typography> : null}{selected.checks.length ? <Box component="ul" sx={{ pl: 2.5 }}>{selected.checks.map((check, index) => <li key={index}>{check.done ? "완료" : "준비 필요"} · {check.label || "체크 내용 미입력"}</li>)}</Box> : null}</Stack> : null}</DialogContent><DialogActions><Button type="button" autoFocus onClick={() => setSelectedId(null)} sx={{ minHeight: 44 }}>닫기</Button></DialogActions>
    </Dialog>
  </Stack>;
}
