import Image from "next/image";
import { Alert, Box, Link, Stack, Typography } from "@mui/material";
import { guideScreenshots } from "../model/screenshots";

export function GuideScreenshots({ ids }: { ids: string[] }) {
  const shots = ids.map(id => guideScreenshots.find(shot => shot.id === id)).filter(shot => shot !== undefined);
  if (!shots.length) return null;
  return <Stack spacing={2}>
    <Alert severity="info">아래 이미지는 개인정보 없는 합성 자료를 슈퍼관리자 화면에서 촬영한 공통 예시입니다. 다른 역할로 로그인해 권한을 검증한 화면은 아닙니다. 실제 사용 가능 범위는 이 설명서의 역할 안내를 확인하세요.</Alert>
    <Typography variant="body2">화면 이름을 눌러 펼치거나 접을 수 있습니다. 작은 글씨는 ‘원본 화면 확대’를 눌러 새 탭에서 확대해 읽으세요.</Typography>
    {shots.map((shot, index) => <Box component="details" key={shot.id} open={index === 0} sx={{ minWidth: 0, border: "1px solid", borderColor: "divider", borderRadius: 2, overflowWrap: "anywhere" }}>
      <Box component="summary" sx={{ p: 1.5, minHeight: 44, cursor: "pointer", fontWeight: 700, "&:focus-visible": { outline: "3px solid", outlineColor: "primary.main", outlineOffset: 2 } }}>{shot.alt.replace(/^v\d+ 슈퍼관리자 합성 예시: /, "")} · v{shot.captureVersion}{shot.captureVersion === 23 ? " 과거 화면" : " 촬영 화면"}</Box>
      <Box component="figure" sx={{ m: 0, p: { xs: 1.5, sm: 2 }, pt: 0, minWidth: 0 }}>
        <Stack component="figcaption" spacing={1} sx={{ mb: 1.5 }}>
          <Typography variant="body2">{shot.caption}</Typography>
          <Typography variant="caption" color="text.secondary">슈퍼관리자 화면의 합성 예시 · v{shot.captureVersion} · {shot.capturedAt} 촬영</Typography>
          {shot.captureVersion === 23 ? <Alert severity="warning">구버전 화면입니다. 현재는 상단 ‘메뉴 열기’로 프로젝트 메뉴를 엽니다. 식단은 날짜·메뉴·진행 상태만 필수이고 나머지는 ‘상세 정보 · 선택’에 있습니다. 레크레이션은 현재 일간·주간 시간표를 지원합니다. 아래 캡처의 메뉴 배치나 카드형 일정을 최신 화면으로 해석하지 마세요.</Alert> : null}
          <Typography variant="caption" color="text.secondary">{shot.usageNotes}</Typography>
          <Link href={shot.src} target="_blank" rel="noopener noreferrer" aria-label={`${shot.alt} 원본 화면 확대 · 새 탭`} sx={{ alignSelf: "flex-start", minHeight: 44, display: "inline-flex", alignItems: "center", py: 1 }}>원본 화면 확대 · 새 탭</Link>
        </Stack>
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, overflow: "hidden", bgcolor: "background.paper" }}><Image src={shot.src} width={shot.width} height={shot.height} alt={shot.alt} unoptimized loading="lazy" style={{ display: "block", width: "100%", height: "auto" }} /></Box>
      </Box>
    </Box>)}
  </Stack>;
}
