import type { Metadata } from "next";
import {
  Alert,
  Box,
  Chip,
  Container,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

export const metadata: Metadata = {
  title: "개인정보 처리지침",
  description: "WBSCowork에서 처리하는 개인정보와 프로젝트 종료 시 파기 절차를 안내합니다.",
};

const effectiveDate = "2026년 10월 8일";

const collectedItems = [
  { primary: "버그 제보 및 검토 기록", secondary: "작성자 계정 참조, 제목, 재현 방법, 예상·실제 결과, 내부 페이지 경로, 추가 설명, 상태·우선순위·해결 내용과 수정 commit 기록" },
  {
    primary: "Google 로그인 정보",
    secondary: "이메일 주소, 이름, Google 계정 식별자, 프로필 이미지 주소, 최근 로그인·동기화 시각",
  },
  {
    primary: "프로젝트 협업 정보",
    secondary: "담당 작업, 제출물과 공개 범위, 댓글, 첨부파일 및 파일명·형식·크기",
  },
  {
    primary: "서비스 이용 기록",
    secondary: "사용자 이메일, 수행 작업, 대상 프로젝트·작업·제출물 식별자, 처리 시각과 오류 기록",
  },
];

const purposes = [
  "비공개 버그 제보 접수, 재현 검토, 개선 상태와 처리 이력 보존",
  "Google 계정을 이용한 본인 확인과 로그인 세션 제공",
  "게스트·일반사용자·관리자 권한 부여 및 비공개 제출물 접근 통제",
  "WBS 작업 배정, 제출물·댓글·첨부파일 기반 프로젝트 협업",
  "보안 사고 예방, 사용자 요청 처리, 장애 분석과 서비스 운영 기록 확인",
];

export default function PrivacyPage() {
  return (
    <Container component="main" maxWidth="md" sx={{ py: { xs: 5, md: 9 } }}>
      <Stack spacing={3}>
        <Stack spacing={1.25}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}>
            <Typography component="h1" variant="h3" sx={{ fontWeight: 800 }}>
              개인정보 처리지침
            </Typography>
            <Chip label={`시행일 ${effectiveDate}`} color="primary" variant="outlined" sx={{ width: "fit-content" }} />
          </Stack>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 760 }}>
            WBSCowork는 프로젝트 협업에 필요한 최소한의 개인정보만 처리하며, 프로젝트가 종료되면 아래 절차에 따라
            관련 정보를 지체 없이 파기합니다.
          </Typography>
        </Stack>

        <Alert severity="info">
          이 페이지는 로그인 전에도 확인할 수 있습니다. 개인정보 관련 문의·열람·정정·삭제 요청은 해당 프로젝트의
          운영 관리자 또는 프로젝트 책임자에게 전달해 주세요.
        </Alert>

        <PolicySection number="1" title="처리 주체와 처리 목적">
          <Typography variant="body1">
            개인정보 처리 주체는 WBSCowork를 설치·운영하는 프로젝트 운영 조직이며, 프로젝트 관리자는 개인정보 보호
            업무와 참여자 요청을 담당합니다. 개인정보는 다음 목적으로만 사용합니다.
          </Typography>
          <BulletList items={purposes} />
        </PolicySection>

        <PolicySection number="2" title="처리하는 개인정보 항목과 수집 방법">
          <List disablePadding>
            {collectedItems.map((item) => (
              <ListItem key={item.primary} disableGutters sx={{ alignItems: "flex-start", py: 1 }}>
                <ListItemText primary={item.primary} secondary={item.secondary} />
              </ListItem>
            ))}
          </List>
          <Typography variant="body2" color="text.secondary">
            로그인 정보는 Google OAuth 인증 과정에서 제공받고, 협업 정보는 사용자가 직접 입력하거나 파일을 업로드할 때
            수집됩니다. WBSCowork는 비밀번호를 직접 수집하거나 저장하지 않습니다.
          </Typography>
        </PolicySection>

        <PolicySection number="3" title="보유 기간">
          <Stack spacing={1.25}>
            <Typography variant="body1">
              프로젝트에 연결된 작업·제출물·댓글·첨부파일은 프로젝트 수행 기간 동안 보유하며, 프로젝트 종료 확인 후
              관리자가 종료·파기 절차를 실행할 때까지 보관합니다.
            </Typography>
            <Typography variant="body1">
              로그인 계정 정보는 참여 중인 프로젝트의 권한 관리에 필요한 동안 보유합니다. 참여 중인 프로젝트가 모두
              종료되거나 이용 목적이 달성된 뒤에는 참여자의 요청 또는 운영 절차에 따라 관리자가 계정 정보를 별도로
              파기합니다. 프로젝트 삭제만으로 여러 프로젝트에서 공유하는 계정 정보가 자동 삭제되지는 않습니다.
            </Typography>
            <Typography variant="body1">
              Sites에서 사용자 작업 감사 기록은 D1에 저장하며 기본 보존 설정은 5일입니다. 기간 밖 기록은 조회에서 제외하고 새 로그가 기록될 때 최대 500건씩 정리하므로 서비스가
              비활성 상태인 기간에는 다음 로그 기록 또는 운영자의 수동 정리 시점까지 남을 수 있습니다. 호스팅 사업자의 별도 진단 로그에는 시각·기능·처리 결과 요약이 남을 수 있으며, 그 보존 기간은 호스팅 사업자 정책에 따릅니다. 관련 법령에
              따라 별도 보존이 필요한 경우에는 해당 정보만 분리하여 법정 기간 동안 보관할 수 있습니다.
            </Typography>
          </Stack>
        </PolicySection>

        <Paper sx={{p:3,borderRadius:3}}><Typography variant="h5">버그 제보의 별도 보존</Typography><Typography>버그 제보는 작성자와 관리자만 조회하며 프로젝트와 독립된 검토 기록으로 보관합니다. 원문은 보존하고 정정·검토 내용은 이력으로 추가합니다. 프로젝트 삭제나 5일 운영 로그 정리는 버그 제보를 삭제하지 않습니다. 서비스 개선·재발 방지에 필요한 동안 보관합니다. 해결·종료 후 관리자가 검증 완료를 기록하면 휴지통으로 이동·복원할 수 있습니다. 휴지통 기록은 관리자에게만 표시됩니다. 슈퍼관리자는 현재 대상과 제목을 확인하여 원문과 전체 이력을 영구 삭제할 수 있으며 앱에서 복구할 수 없습니다. 삭제 시각·수행자 계정 연결·대상 번호·버전·이력 수·내용 지문과 재시도 식별자는 본문 없이 별도 감사 증빙으로 보관합니다. 호스팅 백업과 진단 기록은 사업자 보존 정책을 따릅니다. 개인정보 삭제 요청은 운영 관리자가 별도로 검토·처리합니다. 계정 파기 시 계정 연결은 제거되지만 본문에 직접 입력한 개인정보까지 자동 제거되지는 않으므로 별도 확인이 필요합니다. 비밀번호·토큰·고객 개인정보를 제보에 포함하지 마세요.</Typography></Paper>

        <PolicySection number="4" title="프로젝트 종료 시 파기 절차와 방법">
          <Alert severity="warning" sx={{ mb: 1 }}>
            프로젝트 종료일 도래만으로 데이터가 자동 삭제되지는 않습니다. 관리자가 산출물 인계와 법정 보존 필요성을
            확인한 후 관리 화면에서 명시적으로 ‘종료 및 파기’를 실행합니다.
          </Alert>
          <List component="ol" sx={{ pl: 3, listStyleType: "decimal" }}>
            <ListItem component="li" sx={{ display: "list-item", pl: 0 }}>
              <ListItemText primary="종료 확인" secondary="프로젝트 책임자가 종료 여부와 필요한 산출물 인계를 확인합니다." />
            </ListItem>
            <ListItem component="li" sx={{ display: "list-item", pl: 0 }}>
              <ListItemText
                primary="프로젝트 데이터 삭제"
                secondary="프로젝트 삭제 시 연결된 작업, 제출물, 댓글, 첨부파일 메타데이터를 데이터베이스에서 함께 삭제합니다."
              />
            </ListItem>
            <ListItem component="li" sx={{ display: "list-item", pl: 0 }}>
              <ListItemText
                primary="전자파일 파기"
                secondary="Sites에서는 비공개 R2 객체를 삭제합니다. DB 삭제 시 정리 대상을 함께 기록하며 파일 삭제에 실패하면 재시도 대기 상태로 남깁니다. 다음 쓰기 요청 또는 슈퍼관리자의 정리 재시도로 완료하고, 모든 파일 삭제가 확인되기 전에는 파기가 완료된 것으로 보지 않습니다. Node 운영 환경은 기존 파일 저장소를 사용합니다."
              />
            </ListItem>
            <ListItem component="li" sx={{ display: "list-item", pl: 0 }}>
              <ListItemText
                primary="잔여 정보 점검"
                secondary="공유 사용자 계정과 단기 운영 로그처럼 다른 프로젝트에도 필요한 정보는 분리해 관리하고, 목적이 끝나면 별도로 파기합니다."
              />
            </ListItem>
          </List>
        </PolicySection>

        <PolicySection number="5" title="제3자 제공과 처리 위탁">
          <Typography variant="body1">
            WBSCowork는 원칙적으로 개인정보를 외부 제3자에게 제공하지 않습니다. 로그인에는 Google OAuth를 사용하므로
            인증 과정에는 Google의 개인정보 처리방침이 적용됩니다. 호스팅·데이터베이스·파일 저장소를 외부 사업자에게
            위탁하는 경우 운영 조직은 위탁 대상과 업무 내용을 참여자에게 별도로 알리고 보호조치를 확인해야 합니다.
          </Typography>
        </PolicySection>

        <PolicySection number="6" title="참여자의 권리와 보호조치">
          <BulletList
            items={[
              "참여자는 자신의 개인정보에 대한 열람, 정정, 삭제, 처리정지를 운영 관리자에게 요청할 수 있습니다.",
              "비공개 제출물은 작성자와 관리자만 확인할 수 있도록 역할과 공개 범위를 적용합니다.",
              "다운로드 응답은 개인 캐시 방지를 위해 private, no-store 정책을 사용합니다.",
              "운영 조직은 관리자 권한을 최소한으로 부여하고 데이터베이스·업로드 저장소·로그 접근을 통제해야 합니다.",
            ]}
          />
        </PolicySection>

        <Divider />

        <Box>
          <Typography variant="body2" color="text.secondary">
            지침 변경 시에는 적용일과 변경 내용을 이 페이지에 공개합니다. 실제 운영 조직의 명칭·연락처, 외부 인프라
            위탁 현황 및 별도 백업 정책은 서비스 공개 전에 운영 환경에 맞게 추가해야 합니다.
          </Typography>
        </Box>
      </Stack>
    </Container>
  );
}

function PolicySection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Paper component="section" elevation={0} sx={{ p: { xs: 2.5, sm: 3.5 }, border: "1px solid", borderColor: "divider", borderRadius: 4 }}>
      <Stack spacing={2}>
        <Typography component="h2" variant="h5" sx={{ fontWeight: 700 }}>
          {number}. {title}
        </Typography>
        {children}
      </Stack>
    </Paper>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <List disablePadding sx={{ pl: 2.5, listStyleType: "disc" }}>
      {items.map((item) => (
        <ListItem key={item} sx={{ display: "list-item", py: 0.5, pl: 0 }}>
          <Typography variant="body1">{item}</Typography>
        </ListItem>
      ))}
    </List>
  );
}
