"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Alert, Box, Button, Checkbox, FormControlLabel, Stack, Typography } from "@mui/material";
import { getAttachmentPreviewKind, type AttachmentTextPreview } from "@/src/shared/lib/attachment-preview";

type Preview = AttachmentTextPreview | { kind: "image"; url: string };
class PreviewLoadError extends Error {}

/** Contents are fetched only on demand through the same authorized download route. */
export default function AttachmentFile({ fileName, fileMimeType, fileSizeBytes, downloadUrl, deleteForm = null }: {
  fileName: string; fileMimeType: string | null; fileSizeBytes: number | null;
  downloadUrl: string; deleteForm?: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [wrap, setWrap] = useState(true);
  const request = useRef<AbortController | null>(null);
  const objectUrl = useRef<string | null>(null);
  const candidate = getAttachmentPreviewKind(fileName, fileMimeType);

  function clear() {
    request.current?.abort(); request.current = null;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
  }
  useEffect(() => () => {
    request.current?.abort();
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, [downloadUrl]);

  async function toggle() {
    clear(); setPreview(null); setError("");
    if (open) { setOpen(false); setLoading(false); return; }
    setOpen(true); setLoading(true); setWrap(true);
    const controller = new AbortController(); request.current = controller;
    try {
      const url = new URL(downloadUrl, window.location.origin); url.searchParams.set("preview", "1");
      const response = await fetch(url, { cache: "no-store", credentials: "same-origin", signal: controller.signal });
      if (!response.ok) {
        throw new PreviewLoadError(response.status === 401 || response.status === 404
          ? "파일을 열 수 없습니다. 로그인과 현재 접근 권한을 확인해 주세요."
          : response.status === 413 ? "미리보기 크기 제한을 초과했습니다. 원본을 다운로드해 주세요."
          : response.status === 415 || response.status === 422 ? "이 파일의 형식이나 인코딩은 미리볼 수 없습니다. 원본을 다운로드해 주세요."
          : "미리보기를 불러오지 못했습니다. 닫은 뒤 다시 시도하거나 원본을 다운로드해 주세요.");
      }
      const type = response.headers.get("content-type")?.split(";")[0];
      if (type === "application/json") {
        const value: AttachmentTextPreview = await response.json();
        if (value.kind !== "text" || typeof value.text !== "string" || value.encoding !== "utf-8") throw new PreviewLoadError("미리보기 응답을 읽을 수 없습니다.");
        if (!controller.signal.aborted) setPreview(value);
      } else if (/^image\/(png|jpeg|gif|webp|avif)$/.test(type ?? "")) {
        const blob = await response.blob();
        if (!controller.signal.aborted) {
          const url = URL.createObjectURL(blob); objectUrl.current = url;
          setPreview({ kind: "image", url });
        }
      } else throw new PreviewLoadError("미리보기를 지원하지 않는 응답입니다. 원본을 다운로드해 주세요.");
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof PreviewLoadError ? failure.message : "미리보기를 불러오지 못했습니다. 닫은 뒤 다시 시도하거나 원본을 다운로드해 주세요.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  return <Stack spacing={1} data-testid="attachment-file" sx={{ minWidth: 0, maxWidth: "100%" }}>
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center", minWidth: 0 }}>
      <Button component="a" href={downloadUrl} download variant="outlined" size="small" sx={{ minWidth: 0, maxWidth: "100%", textAlign: "left", overflowWrap: "anywhere" }}>{fileName}</Button>
      <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>{fileSizeBytes === null ? "" : `${fileSizeBytes.toLocaleString("ko-KR")} bytes`}</Typography>
      {candidate ? <Button size="small" onClick={toggle} aria-expanded={open} aria-controls={id}>{open ? "미리보기 닫기" : "미리보기"}</Button> : <Typography variant="caption" color="text.secondary">미리보기 미지원 · 다운로드</Typography>}
      {deleteForm}
    </Stack>
    {open ? <Box id={id} role="region" aria-label={`파일 미리보기: ${fileName}`} sx={{ minWidth: 0 }}>
      {loading ? <Typography role="status">미리보기 불러오는 중…</Typography> : null}
      {error ? <Alert severity="warning">{error}</Alert> : null}
      {preview?.kind === "text" ? <Stack spacing={0.5}>
        <Typography variant="caption">UTF-8 · 텍스트로 표시합니다.</Typography>
        {preview.truncated ? <Alert severity="info">파일이 커서 처음 256 KiB까지만 표시합니다. 전체 내용은 원본을 다운로드해 주세요.</Alert> : null}
        <FormControlLabel control={<Checkbox checked={wrap} onChange={event => setWrap(event.target.checked)} size="small" />} label="줄바꿈" />
        {preview.text ? <Box component="pre" tabIndex={0} aria-label="파일 텍스트" sx={{ m: 0, p: 1.5, maxHeight: { xs: 320, sm: 480 }, maxWidth: "100%", overflow: "auto", whiteSpace: wrap ? "pre-wrap" : "pre", overflowWrap: wrap ? "anywhere" : "normal", bgcolor: "action.hover", borderRadius: 1, fontSize: "0.875rem" }}>{preview.text}</Box> : <Typography>빈 텍스트 파일입니다.</Typography>}
      </Stack> : null}
      {preview?.kind === "image" && !error ? <Box component="img" src={preview.url} alt={fileName} onError={() => { clear(); setPreview(null); setError("이미지를 표시할 수 없습니다. 원본을 다운로드해 주세요."); }} sx={{ display: "block", maxWidth: "100%", maxHeight: 480, objectFit: "contain", borderRadius: 1 }} /> : null}
    </Box> : null}
  </Stack>;
}
