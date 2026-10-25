import Image from "next/image";
import { Alert, Box, Link, Stack, Typography } from "@mui/material";
import { guideScreenshots } from "../model/screenshots";

export function GuideScreenshots({ ids }: { ids: string[] }) {
  const shots = ids.map(id => guideScreenshots.find(shot => shot.id === id)).filter(shot => shot !== undefined);
  if (!shots.length) return null;
  return <Stack spacing={2}>
    <Alert severity="info">아래 이미지는 개인정보 없는 합성 자료를 슈퍼관리자 화면에서 촬영한 공통 예시입니다. 다른 역할로 로그인해 권한을 검증한 화면은 아닙니다. 실제 사용 가능 범위는 이 설명서의 역할 안내를 확인하세요.</Alert>
    {shots.map(shot => <Box component="figure" key={shot.id} sx={{ m: 0, minWidth: 0 }}>
      <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden", bgcolor: "background.paper" }}><Image src={shot.src} width={shot.width} height={shot.height} alt={shot.alt} unoptimized loading="lazy" style={{ display: "block", width: "100%", height: "auto" }} /></Box>
      <Stack component="figcaption" spacing={0.5} sx={{ mt: 1 }}><Typography variant="body2">{shot.caption}</Typography><Typography variant="caption" color="text.secondary">슈퍼관리자 화면의 합성 예시 · {shot.capturedAt} 촬영</Typography><Link href={shot.src} target="_blank" rel="noopener noreferrer" sx={{ alignSelf: "flex-start", py: 1 }}>원본 화면 새 탭에서 보기</Link></Stack>
    </Box>)}
  </Stack>;
}
