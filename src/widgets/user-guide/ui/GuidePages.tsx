import Link from "next/link";
import { Alert, Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { getGuideFeature, guideGettingStarted, guideGlossary, guideRoles, type GuideFeature, type GuideRole, type GuideStep } from "@/src/entities/user-guide";
import { GuideFrame, GuideSection } from "./GuideFrame";
import { GuideScreenshots } from "./GuideScreenshots";
import { guideScreenshots } from "../model/screenshots";

function Steps({ steps }: { steps: GuideStep[] }) {
  return <Stack component="ol" spacing={2} sx={{ m: 0 }}>{steps.map((step, index) => <Box component="li" key={index}><Typography component="h3" variant="subtitle1" sx={{fontWeight:700}}>{step.title}</Typography><Typography sx={{ mt: 0.5 }}>{step.body}</Typography></Box>)}</Stack>;
}
function TextList({ items }: { items: string[] }) {
  return <Box component="ul" sx={{ my: 0 }}>{items.map(item => <li key={item}>{item}</li>)}</Box>;
}
function FeatureCards({ role }: { role: GuideRole }) {
  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>{role.featureIds.map(id => {
    const feature = getGuideFeature(role.id, id);
    if (!feature) return null;
    return <Paper key={id} variant="outlined" sx={{ p: 2.5, minWidth: 0 }}><Stack spacing={1.5}><Typography component="h3" variant="h6">{feature.title}</Typography><Typography color="text.secondary">{feature.summary}</Typography><Typography variant="body2">찾는 곳: {feature.menu}</Typography><Button component="a" href={`/guide/${role.id}/${id}`} variant="outlined" sx={{ alignSelf: "flex-start" }}>{feature.title} 사용 순서</Button></Stack></Paper>;
  })}</Box>;
}
function Glossary() {
  return <Box component="dl" sx={{ m: 0 }}>{guideGlossary.map(item => <Box key={item.term} sx={{ mb: 2.5 }}><Typography component="dt" variant="h6">{item.term}</Typography><Typography component="dd" sx={{ m: 0, mt: 0.5 }}>{item.description}</Typography><Typography component="dd" color="text.secondary" sx={{ m: 0, mt: 0.5 }}>예: {item.example}</Typography></Box>)}</Box>;
}

export function UserGuideHome() {
  return <GuideFrame title="WBSCowork 사용설명서" intro="처음 사용하는 분도 프로젝트를 찾고, 맡은 일을 진행하고, 결과를 확인할 수 있도록 차례대로 안내합니다. 먼저 공통 시작 방법을 읽고 자신의 역할에 가까운 안내를 선택하세요." contents={[{ id: "start", label: "처음 시작하기" }, { id: "roles", label: "내 역할 선택하기" }, { id: "terms", label: "헷갈리는 말 알아보기" }, { id: "help", label: "막혔을 때 확인하기" }]}>
    <GuideSection id="start" title="1. 처음 시작하기"><Steps steps={guideGettingStarted} /><GuideScreenshots ids={["main-home"]} /><Alert severity="info">이 설명서는 로그인 없이 읽을 수 있습니다. 여기서 역할을 고르는 것은 설명을 골라 보는 일이며 실제 계정 권한은 바뀌지 않습니다.</Alert></GuideSection>
    <GuideSection id="roles" title="2. 내 역할에 맞는 설명 고르기"><Typography>계정의 등급, 프로젝트 소속, 팀장 지정은 서로 다릅니다. 한 사람이 여러 프로젝트에 소속되거나 특정 팀의 팀장을 함께 맡을 수 있습니다. 정확한 역할을 모르겠다면 작업 화면의 ‘현재 권한’ 표시와 현재 프로젝트의 팀장 표시를 확인하고 슈퍼관리자에게 문의하세요.</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>{guideRoles.map(role => <Paper component="section" key={role.id} aria-labelledby={`role-${role.id}`} variant="outlined" sx={{ p: 2.5, minWidth: 0 }}><Stack spacing={1.5}><Typography id={`role-${role.id}`} component="h3" variant="h5">{role.label}</Typography><Typography color="text.secondary">{role.subtitle}</Typography><Typography>{role.meaning}</Typography><Button component="a" href={`/guide/${role.id}`} variant="contained" sx={{ alignSelf: "flex-start" }}>{role.label} 안내 보기</Button></Stack></Paper>)}</Box>
    </GuideSection>
    <GuideSection id="terms" title="3. 헷갈리는 말 알아보기"><Glossary /></GuideSection>
    <GuideSection id="help" title="4. 화면이 다르거나 저장이 안 될 때"><TextList items={["작은 화면에서는 왼쪽 위 ‘메뉴 열기’를 눌러 작업·내 업무·검색·알림·버그 제보를 찾습니다. 사용설명서는 책 모양 버튼이나 모바일 메뉴에서 다시 열 수 있습니다.", "프로젝트나 버튼이 보이지 않으면 로그인 상태, 프로젝트 소속, 현재 맡은 역할을 먼저 확인하세요. 주소를 직접 입력해도 권한이 추가되지는 않습니다.", "저장 오류가 나면 입력한 내용을 먼저 보관하고 오류 문구를 읽으세요. 여러 번 누르기보다 저장 결과와 새로고침 후 내용을 확인합니다.", "해결되지 않으면 버그 제보에 재현 순서와 기대한 결과를 적습니다. 스크린샷에는 이름·이메일·비공개 내용이 보이지 않게 확인하세요."]} /><Button component="a" href="/bugs" variant="outlined" sx={{ alignSelf: "flex-start" }}>버그 제보 화면 열기 · 로그인 필요</Button></GuideSection>
  </GuideFrame>;
}

export function UserGuideRole({ role }: { role: GuideRole }) {
  return <GuideFrame title={`${role.label} 사용 안내`} intro={role.meaning} breadcrumbs={[{ label: "사용설명서", href: "/guide" }]} contents={[{ id: "first", label: "처음 해야 할 일" }, { id: "scope", label: "할 수 있는 일과 범위" }, { id: "features", label: "기능별 사용 순서" }, { id: "role-help", label: "권한이 맞지 않을 때" }]}>
    <GuideSection id="first" title="1. 처음 해야 할 일"><Steps steps={role.firstSteps} /></GuideSection>
    <GuideSection id="scope" title="2. 할 수 있는 일과 지켜야 할 범위"><Alert severity="info">역할 이름만으로 모든 자료를 볼 수 있는 것은 아닙니다. 현재 프로젝트 소속과 해당 자료의 공개 범위도 함께 적용됩니다.</Alert><Paper variant="outlined" sx={{ p: 2.5 }}><Typography component="h3" variant="h6" gutterBottom>할 수 있는 일</Typography><TextList items={role.canDo} /></Paper><Paper variant="outlined" sx={{ p: 2.5 }}><Typography component="h3" variant="h6" gutterBottom>이 역할만으로는 할 수 없는 일</Typography><TextList items={role.cannotDo} /></Paper></GuideSection>
    <GuideSection id="features" title="3. 기능별 사용 순서"><Typography>원하는 기능을 열면 메뉴 위치, 입력 예시, 저장 후 확인과 오류 대처 방법을 볼 수 있습니다. 읽기 전용인 역할은 해당 기능의 작성 제한도 함께 확인하세요.</Typography><FeatureCards role={role} /></GuideSection>
    <GuideSection id="role-help" title="4. 실제 화면의 권한이 다르다면"><Typography>설명서에서 선택한 역할은 계정에 적용되지 않습니다. 프로젝트가 목록에 없거나 수정 버튼이 비활성화돼 있다면 슈퍼관리자에게 현재 소속과 계정 등급을 확인해 달라고 요청하세요. 팀장의 담당 팀이나 팀장 교체는 해당 프로젝트 관리자에게 확인합니다.</Typography><Button component="a" href="/guide#roles" variant="outlined" sx={{ alignSelf: "flex-start" }}>다른 역할의 안내도 살펴보기</Button></GuideSection>
  </GuideFrame>;
}

export function UserGuideFeature({ role, feature }: { role: GuideRole; feature: GuideFeature }) {
  const hasScreenshots = feature.screenshotIds.some(id => guideScreenshots.some(shot => shot.id === id));
  const related = feature.related.map(id => getGuideFeature(role.id, id)).filter(item => item !== undefined);
  return <GuideFrame title={feature.title} intro={feature.summary} breadcrumbs={[{ label: "사용설명서", href: "/guide" }, { label: `${role.label} 안내`, href: `/guide/${role.id}` }]} contents={[{ id: "where", label: "메뉴와 사용 범위" }, { id: "steps", label: "차례대로 따라 하기" }, { id: "example", label: feature.readingOnly ? "화면 확인 예시" : "입력 예시" }, { id: "confirm", label: feature.readingOnly ? "확인 체크리스트" : "저장 후 확인" }, ...(hasScreenshots ? [{ id: "screens", label: "실제 화면 예시" }] : []), { id: "errors", label: "오류가 나면" }, { id: "limits", label: "권한과 주의할 점" }, { id: "related", label: "이어서 읽기" }]}>
    <GuideSection id="where" title="1. 어디서 시작하나요?"><Chip label={`${role.label} 안내`} color="primary" sx={{ alignSelf: "flex-start", maxWidth: "100%", height: "auto", "& .MuiChip-label": { whiteSpace: "normal" } }} /><Typography>메뉴에서 {feature.menu} 순서로 찾으세요. 작은 화면에서는 왼쪽 위 ‘메뉴 열기’를 먼저 누릅니다.</Typography><Alert severity="info">실제 사용 가능 범위는 현재 계정과 프로젝트·팀 소속에 따라 달라집니다. 이 페이지는 사용 방법을 설명하며 권한을 부여하거나 계정을 변경하지 않습니다.</Alert>{feature.href ? <Button component="a" href={feature.href} variant="outlined" sx={{ alignSelf: "flex-start" }}>앱에서 시작 위치 열기 · 로그인 필요</Button> : null}</GuideSection>
    <GuideSection id="steps" title="2. 차례대로 따라 해보세요"><Steps steps={feature.steps} /></GuideSection>
    <GuideSection id="example" title={feature.readingOnly ? "3. 화면에서 확인하는 예시" : "3. 이렇게 입력할 수 있어요"}><Paper variant="outlined" sx={{ p: 2.5, minWidth: 0 }}><Stack spacing={1.5}><Typography component="h3" variant="h6">{feature.example.title}</Typography><Typography variant="body2" color="text.secondary">{feature.readingOnly ? "아래 값은 읽는 순서를 설명하는 합성 예시입니다. 실제 화면에서는 현재 허용된 자료를 확인하세요. 이 안내에서 입력이나 저장을 할 필요는 없습니다." : "아래 값은 사용 순서를 설명하는 합성 예시입니다. 실제 활동에 맞게 바꿔 입력하세요."}</Typography><Box component="dl" sx={{ m: 0 }}>{feature.example.values.map(value => <Box key={value.field} sx={{ mb: 1.5 }}><Typography component="dt" sx={{fontWeight:700}}>{value.field}</Typography><Typography component="dd" sx={{ m: 0, whiteSpace: "pre-wrap" }}>{value.value}</Typography></Box>)}</Box></Stack></Paper></GuideSection>
    <GuideSection id="confirm" title={feature.readingOnly ? "4. 확인한 내용을 점검하세요" : "4. 저장한 뒤 확인하세요"}><TextList items={feature.checks} /></GuideSection>
    {hasScreenshots ? <GuideSection id="screens" title="실제 화면으로 살펴보기"><GuideScreenshots ids={feature.screenshotIds} /></GuideSection> : null}
    <GuideSection id="errors" title="5. 오류가 나거나 화면이 다르다면"><Box component="dl" sx={{ m: 0 }}>{feature.troubleshooting.map(item => <Box key={item.issue} sx={{ mb: 2.5 }}><Typography component="dt" variant="h6">{item.issue}</Typography><Typography component="dd" sx={{ m: 0, mt: 0.5 }}>{item.action}</Typography></Box>)}</Box></GuideSection>
    <GuideSection id="limits" title="6. 권한과 주의할 점"><TextList items={feature.limits} /><Typography variant="body2" color="text.secondary">팀장이나 검토자로 지정돼도 비공개 자료를 볼 권한이 자동으로 늘어나지는 않습니다. 제한 프로젝트에서 소속이 해제되면 과거의 본인 자료도 접근이 막힐 수 있으며 기록은 보존됩니다.</Typography></GuideSection>
    <GuideSection id="related" title="이어서 읽기"><Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: "wrap" }}>{related.map(item => <Button component="a" key={item.id} href={`/guide/${role.id}/${item.id}`} variant="outlined">{item.title}</Button>)}<Button component="a" href={`/guide/${role.id}`}>{role.label} 기능 목록으로</Button></Stack><Typography variant="caption" color="text.secondary">공통 용어가 낯설다면 <Link href="/guide#terms">헷갈리는 말 알아보기</Link>를 함께 읽어보세요.</Typography></GuideSection>
  </GuideFrame>;
}
