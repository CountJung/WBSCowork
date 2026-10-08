# Sites 공개 게시 결과 — 2026-10-08

## 배포 확인

- 서비스: https://wbscowork.cometgnome.chatgpt.site
- 접근 범위: public. 로그인 화면은 주소를 아는 사람이 접근할 수 있고 데이터·기능은 기존 Google 인증과 역할 정책으로 제한한다.
- Site project: `appgprj_6ac75dba14348191801b002e0f2a0937` (재등록 없음)
- 게시 version: 1
- version ID: `appgprj_6ac75dba14348191801b002e0f2a0937~appgver_7894d6e0447c81919f700409977c8dc8`
- deployment: `appgdep_6ac7712050308191955deb33769f87fa`
- 최종 상태: succeeded, 2026-10-08 10:32:16 UTC
- 적용된 환경 revision: 11
- 게시된 소스: `9938b584c08f805f1321061643a1b3fb6339260e`
- 게시 소스 tree: `3fa3f4fabaa6b26e77d2adffec2b710c22721dd6`
- GitHub branch: `feat/sites-deployment`
- 보존된 GitHub main: `2f6b74d7b77106d38ad914eee14e1e073c61b039`

이 문서는 게시 후 추가한 기록이다. 문서-only 후속 commit과 위 실제 배포 commit을 구분한다. 운영 데이터나 기존 사용자 role은 이전하지 않았고 실제 계정의 권한을 임의로 부여하지 않았다.

## 운영 화면 및 로그인 확인

지원되는 클라우드 브라우저로 실제 공개 홈을 확인했다.

- 1180px desktop 및 500px narrow/mobile 폭: 기존 MUI 화면, 줄바꿈·hamburger 메뉴, 수평 overflow 없음.
- 앱 출처의 console 오류는 발견하지 않았다. 브라우저 확장 프로그램 metadata 안내 오류는 앱 오류와 구분했다.
- Google 로그인 버튼이 실제 Google 식별자 화면으로 이동했다. callback은 `/api/auth/callback/google`, scope는 openid/email/profile, PKCE가 포함된다.
- 해당 시점의 최근 Worker error log는 0건이었다.
- 사용자는 2026-10-08 본인 브라우저에서 로그인 성공을 확인했다고 보고했다. 이는 브라우저에서 직접 관찰한 로그인 진입과 별도 근거로 기록한다.
- 소유자는 클라우드 브라우저에 직접 로그인하기 위한 제어권을 요청했다. 비밀번호·MFA·Google 동의는 사용자가 직접 처리하며, 선택된 계정과 앱 role은 로그인 완료 후 확인한다. 이 기록 시점에는 계정 정보나 비밀값을 입력하지 않았다.

shell에서 시작한 별도 Chromium은 IPC EPERM으로 실패했다. 이 제한을 보안 설정 변경으로 우회하지 않았고, 이후 지원되는 클라우드 브라우저 경로로 공개 홈을 확인했다. 390px 정밀 viewport, 인증 후 프로젝트 화면의 실제 브라우저 CRUD, 지정 테스트 계정 권한 변경은 아직 완료하지 않았다.

## 자동 검증

- lint, TypeScript, FSD 통과 (FSD fixture 5건)
- Node 단위 검사 14건
- 실제 Worker 인증 계약 18건
- 실제 D1/R2 및 실패 복구 57건
- 실제 Worker HTTP 역할·첨부·로그아웃·동시 20MiB 업로드 92건

합성 세션 검사를 실제 Google 계정 로그인으로 표현하지 않는다. 세부 범위는 [최종 검증 기록](SITES_VALIDATION_2026-10-08.md)을 참고한다.

## 이 클라우드 실행 환경의 디스크 스냅샷

2026-10-08 약 10:38 UTC에 측정했다. 아래는 **현재 이 실행 환경**의 디렉터리 크기이며 이전 별도 컨테이너의 추가 설치 실측 `4.236095 GB / 3.945171 GiB`와 다른 결과다. 여기에는 이전 MariaDB/Docker 설치 실측을 합치지 않는다.

`du -sB1` 할당 블록 기준:

| 대상 | byte |
| --- | ---: |
| 작업 checkout 전체 (node_modules 포함) | 1,096,945,664 |
| node_modules (위 전체의 부분집합) | 1,083,822,080 |
| Git history (위 전체의 부분집합) | 4,247,552 |
| Worker/client dist (위 전체의 부분집합) | 4,927,488 |
| npm cache | 1,020,772,352 |
| checkout + npm cache의 du 합계 | 2,117,718,016 |

합계는 약 **2.118 GB / 1.972 GiB**다. 중첩 행을 다시 더하지 않는다. `du`의 디렉터리 할당량과 overlay filesystem의 실제 사용량은 계층·공유 방식 때문에 동일하지 않을 수 있다. `df -B1` 당시 filesystem 전체 사용 1,270,194,176 byte, 여유 30,765,236,224 byte였다. 이 값은 이 작업만의 독점 사용량이 아니다.

`du -b` 파일 논리 크기는 checkout 966,154,210 byte + npm cache 1,015,565,512 byte였다. 로컬 gzip 배포 archive는 1,367,778 byte이다. 배포 서비스는 이를 자체 tar 형식으로 저장하므로 반환 archive size와 압축 파일 크기는 다르다.

이 환경의 설치 전 정확한 byte 기준선은 확보하지 않았으므로 위 스냅샷을 ‘추가 설치량’으로 표현하지 않는다. 도구, cache, 빌드 출력은 용량을 줄여 보이기 위해 삭제하지 않았다.
