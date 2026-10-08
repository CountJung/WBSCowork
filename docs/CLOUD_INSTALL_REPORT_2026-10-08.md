# WBSCowork 클라우드 설치·검증·용량 실측 — 2026-10-08

현재 클라우드에서 개발도구·개발 의존성·MariaDB 이미지·디스크 테스트 데이터까지 준비한 뒤, **실제 추가 디스크 사용량은 4.236095 GB / 3.945171 GiB**, 여유는 **27.798471 GB / 25.889343 GiB**이다. 측정 시각은 `2026-10-08T08:51:23.658218+00:00`이다. 이 값은 이 환경의 Docker `vfs` 구현과 정지된 두 검증 컨테이너를 포함한다. 게시 완료나 운영 용량 추정치가 아니다.

## 1. 대상과 변경 범위

- 실제 checkout: `2f6b74d7b77106d38ad914eee14e1e073c61b039`. GitHub main으로 앞서 확인된 SHA와 일치한다. 작업 시작 시 clean이었다.
- 전달받은 별도 Lenovo 조사도 main/origin main/HEAD가 같은 SHA이며 작업 전후 clean이다. 여기서 Lenovo를 직접 측정한 것은 아니다. Lenovo 논리적 875.62 MiB, node_modules 434.63 MiB, .next 435.89 MiB(대부분 dev)는 별도 참고값으로 클라우드 합계에 포함하지 않는다.
- `/workspace/WBSCowork/AGENTS.md`, `.github/copilot-instructions.md`, quality-gates/nextjs-stack 지침, TODO/HARNESS_MAP, package/lock, 실행·DB·테스트 하네스를 확인했다. `/workspace/.agents`는 비어 있고 저장소 `.agents/skills`도 없다. 관련 프로젝트 스킬은 `.github/skills`에 있으나 UI/Stage 1/digest/문서 렌더러 구현을 변경하지 않아 해당 구현 스킬은 실행하지 않았다. 설치 후 Next 16.2.4의 동봉 font 문서·loader도 읽었다.
- 앱·OAuth·역할 정책·tests·기존 scripts·package/lock·Next config·compose 원본은 변경하지 않았다. 저장소 변경은 이 보고서와 `docs/TODO.md` T-022, `docs/HARNESS_MAP.md` 13절뿐이다. 보완 파일은 저장소 밖 `/workspace/wbs-cloud-audit`에 있다.
- `.env*`는 읽거나 쓰지 않았다. 운영 DB·실제 사용자·첨부 데이터에 접근하지 않았다. 계정 가입/자격증명 사용·생성/커밋/푸시/배포/공개 터널/방화벽·sysctl·TLS 보안 변경을 하지 않았다.

## 2. 설치 전과 실제 df 증분

첫 읽기 명령의 `/workspace` df Used는 843,776 bytes, Available은 32,034,586,624 bytes였다. 증거 디렉터리 생성 직후이면서 **설치 전**인 `baseline.json`의 Used는 864,256 bytes, Available은 32,034,566,144 bytes였다. 계산 기준은 재현 파일이 있는 후자이며, 두 기준의 차이는 20,480 bytes이다.

| 지표 | bytes | GB / GiB |
| --- | ---: | --- |
| 설치 전 overlay Used | 864,256 | 0.000864 GB / 0.000805 GiB |
| 완료 overlay Used | 4,236,959,744 | 4.236960 GB / 3.945976 GiB |
| 실제 추가 사용량 (위 두 값의 차이) | 4,236,095,488 | 4.236095 GB / 3.945171 GiB |
| 전체 파일시스템 크기 | 33,770,192,896 | 33.770193 GB / 31.450943 GiB |
| 완료 Available | 27,798,470,656 | 27.798471 GB / 25.889343 GiB |

`/workspace`, `/`, `/var/lib/docker`는 같은 overlay이므로 한 번만 센다. `df Available`은 reserve 등을 반영해 Size−Used와 다를 수 있다. `/tmp`는 별도 tmpfs이고 완료 시 Used 22,499,328 bytes(약 22.50 MB)여서 실제 디스크 증분에 합산하지 않는다. 보고서/증거 저장 중 수 KB 수준 변동은 있을 수 있다.

초기 Git은 2,605,056 bytes, 소스·문서는 2,150,400 bytes, 합계 4,755,456 bytes였다. checkout과 기반 도구는 overlay의 읽기 전용 lower layer에 이미 있어 `du`와 초기 `df Used`가 서로 다르다. 아래 `du`를 초기 df에 더해 기반 이미지 총량이라고 해석하면 안 된다.

## 3. 범주별 보존 파일과 DB

`du -s -B1`의 할당량이다. 상위와 하위를 중복 합산하지 않도록 소스와 감사 디렉터리에서 **절대 경로로** 생성물 하위 경로를 제외했다. 1 GB=10^9 bytes, 1 GiB=2^30 bytes이다.

| 범주 | bytes | GB | GiB |
| --- | ---: | ---: | ---: |
| Git 저장소 `.git` | 2,605,056 | 0.002605 | 0.002426 |
| 소스·문서 (아래 생성물 제외) | 2,179,072 | 0.002179 | 0.002029 |
| 개발 의존성을 포함한 `node_modules` | 693,088,256 | 0.693088 | 0.645489 |
| 추가 Node 26 공식 배포 전체 (npm/headers/docs 포함) | 240,029,696 | 0.240030 | 0.223545 |
| Node 압축파일·공식 폰트·읽은 개발 문서 다운로드 | 35,491,840 | 0.035492 | 0.033054 |
| npm 다운로드 캐시 | 182,145,024 | 0.182145 | 0.169636 |
| `.next` production 빌드·캐시 | 36,417,536 | 0.036418 | 0.033916 |
| `tsconfig.tsbuildinfo` | 274,432 | 0.000274 | 0.000256 |
| `next-env.d.ts` | 4,096 | 0.000004 | 0.000004 |
| 테스트 파일·업로드·로그 `.test-artifacts` | 98,304 | 0.000098 | 0.000092 |
| production HTTP 실행 로그 `logs` | 20,480 | 0.000020 | 0.000019 |
| 정지 후 보존된 디스크 DB datadir | 156,897,280 | 0.156897 | 0.146122 |
| 검증 로그·측정 JSON·환경 보완 스크립트 (tools/cache/data 제외) | 565,248 | 0.000565 | 0.000526 |
| MariaDB 이미지 하나의 Docker 보고 크기 (논리적) | 333,281,648 | 0.333282 | 0.310393 |

위 파일 디렉터리 합계는 1.349816 GB / 1.257114 GiB이다. 여기에 MariaDB 이미지의 논리적 크기 **한 번만** 포함한 자산 목록 합계는 1.683098 GB / 1.567507 GiB이다. `du` 할당량과 Docker logical Size를 합친 참고 목록이며 **실제 추가 df 사용량과 같은 지표가 아니다**. 기본 이미지 도구도 이 목록에는 더하지 않았다.

- Node 26 전체 240,029,696 bytes 안에 node 바이너리 150,048,768 bytes와 npm 디렉터리 18,944,000 bytes가 포함되어 있다. 이 두 하위 값을 다시 합산하지 않는다.
- MariaDB 서버·클라이언트·install-db·backup은 이미지에 포함돼 있다. 호스트 native MariaDB 패키지를 추가 설치하지 않았다. 이미지 안의 서버 25,669,632 bytes, CLI 5,279,744 bytes 등은 이미지의 하위 구성으로 별도 합산하지 않는다.
- Docker 테스트 DB(3307)는 원본 compose의 `/var/lib/mysql` tmpfs를 유지했다. 실행 중 169,480,192 bytes = 0.169480 GB / 0.157841 GiB는 **메모리**이며 디스크형 DB에 합산하지 않는다. 정지로 이 tmpfs 내용은 사라졌다.
- 디스크 DB(3308)는 agent UID/GID 1000의 `/workspace/wbs-cloud-audit/db-disk`를 bind mount했다. `df -T /var/lib/mysql`은 overlay이며 tmpfs가 아니다. 테스트 직후 169,525,248 bytes, 재기동 중 169,517,056 bytes, 정상 정지 후 156,897,280 bytes를 보존했다. 약 12 MiB의 `ibtmp1`는 MariaDB의 정상 종료 동작으로 제거된다. 소스·다운로드 캐시 삭제가 아니다.
- 디스크 DB 정상 stop/start 전후 6개 테이블과 테스트 역할 분포(admin 2/member 2/guest 1)가 일치했다. 이는 fixture이며 기존 운영 사용자 역할을 복사한 데이터가 아니다. 디스크에 남아 있으나 **플랫폼 수명과 무관한 영구 보존 보장은 확인되지 않았다**.
- 여기의 `.next`는 production 산출물이다. dev 서버/브라우저를 실행하지 않았으므로 Lenovo의 큰 dev `.next`와 직접 비교하지 않는다. production HTTP 서버는 실제로 실행했다.

## 4. Docker 실제 공간 증가와 기존 기반 도구

기반 Docker/Compose 28.4.0 / 2.40.3이 이미 설치돼 있고 데몬이 기동돼 있었다. 초기 이미지·컨테이너·volume·build cache는 0이었다. 이번에는 [MariaDB 공식 이미지](https://hub.docker.com/_/mariadb)의 11.4를 실제 pull하고 사용했다.

```
image ID: sha256:ab3dff582d246358b6f6a1f6212f29ac64609fad883eb3dcfb0a89f6f7d0700e
digest: mariadb@sha256:1292844148b311e4ed4300022a996d39083f415a963e970cf47cad1b3b18e3a6
server: 11.4.13-MariaDB-ubu2404 (amd64)
```

`docker system df -v`의 이미지 shared size는 0, unique size는 333.3 MB, 컨테이너 수는 2다. 이미지가 두 개 있는 것이 아니다. Docker의 reported writable delta는 disk 0 B, tmpfs 2 B이고 volume/build cache는 0이다.

이 호스트의 driver는 `vfs`다. vfs는 이전 layer를 깊게 복사하여 공간을 더 사용한다. [Docker 공식 vfs 문서](https://docs.docker.com/engine/storage/drivers/vfs-driver/). 따라서 표시상 333 MB 이미지가 실제 호스트 디스크 333 MB라는 뜻은 아니다.

| 실측 구간 | 전체 df 증가 | 알려진 디렉터리 증가 제외 후 잔차 |
| --- | ---: | ---: |
| 이미지 pull 전후 | 1,515,130,880 bytes | 1,515,110,400 bytes |
| pull 후→tmpfs 검증/첫 빌드 실패 완료 | 723,861,504 bytes | 688,062,464 bytes |
| disk 컨테이너/datadir 생성 전후 | 856,973,312 bytes | 688,021,504 bytes |

잔차 합 약 2.891 GB는 vfs 이미지·컨테이너 복제/메타데이터에 해당하는 **구간 기반 추정**이다. 직접 `/var/lib/docker`를 읽을 권한이 없고 sudo도 없어 개별 vfs 디렉터리 du는 측정하지 못했다. 구간에는 소량의 환경 메타데이터 변동이 포함될 수 있다. 이 잔차나 333 MB를 이미 포함된 전체 df 증분에 다시 더하지 않았다. 호스트 보안이나 driver를 변경하지 않았다. 두 컨테이너는 정상 정지 후 보존했다.

| 시작 전에 이미 있던 도구 (측정 범위) | 할당량 | 이번 설치 증분 |
| --- | ---: | --- |
| Node 24.19.0/npm 11.9.0 기반 runtime 디렉터리 전체 | 0.503788 GB / 0.469189 GiB | 0 |
| 위 디렉터리의 node 바이너리 / npm | 125,992,960 / 16,183,296 bytes | 위 값에 포함 |
| Docker CLI/daemon/Compose·buildx/containerd/runc 등 측정한 파일 | 0.385204 GB / 0.358749 GiB | 0 |
| Git 바이너리 `/usr/local/bin/git` | 19,296,256 bytes | 0 |

Docker 도구 합계는 한 `du -c` 호출로 hard link 중복을 피했다. Node 기반 디렉터리에는 다른 기존 Node 도구도 있으며, Git 행은 바이너리만이다. Python/curl/shell/OS 전체는 포함하지 않은 **관련 도구 인벤토리**로 기반 이미지 전체 크기는 아니다. 브라우저는 설치·사용하지 않았고 이번 용량에도 포함하지 않았다.

## 5. 버전·설치·검증 결과

추가 Node 공식 `v26.11.1` Linux x64 배포 + 동봉 npm `11.20.0`을 별도 경로에 설치했다. [공식 배포](https://nodejs.org/dist/v26.11.1/)의 SHASUMS256.txt와 다운로드 tar.xz의 SHA256이 일치한다. 기반 도구는 교체하지 않았다.

Next 16.2.4 / React·React DOM 19.2.4 / NextAuth 4.24.14 / npm mariadb 3.5.2 / TypeScript 5.9.3 / tsx 4.23.13 / ESLint 9.39.4 / MUI 9.0.0 / npm lockfile v3.

| 실행 | exit | 결과 / 증거 로그 (감사 디렉터리 `evidence/`) |
| --- | ---: | --- |
| `npm ci --include=dev` | 0 | 541개, `npm-ci.log` |
| `npm rebuild esbuild sharp unrs-resolver` | 0 | 별도 고정 버전 install-hook 설정, `npm-rebuild.log`; 최종 unreviewed hook 없음 |
| `npm run lint` | 0 | 오류·경고 없음, `lint.log` |
| `npm run typecheck` | 0 | `typecheck.log`; production build 내부 TypeScript도 PASS |
| `npm run check:fsd` | 0 | fixture 5건 PASS, 위반 0, `check-fsd.log` |
| `npm run test:unit` | 0 | 14/14 PASS, `unit.log` |
| DB 없는 `npm test` | 0 | 14 unit PASS, DB suite 건너뜀, `test-without-db.log` |
| DB 없는 `npm test -- --require-db` | 1 | ECONNREFUSED로 의도한 실패, `require-db-without-db.log` |
| tmpfs DB + `npm test -- --require-db` | 0 | unit 14 + DB 33 = 47 PASS, skip 0, `require-db-tmpfs.log` |
| disk DB + `TEST_DB_PORT=3308 npm test -- --require-db` | 0 | 47 PASS, skip 0, `require-db-disk.log` |
| 격리 DB `npm run db:check` / `-- --validate-only` | 0 / 0 | `db-check.log`, `db-validate.log` |
| 기본 `npm run build` | 1 | Roboto Google Fonts fetch 실패, `build.log` |
| 로컬 absolute font URL을 넣은 첫 보완 build | 1 | Turbopack font request URL 오류, `build-offline.log` |
| 실제 폰트 loopback HTTP + 별도 fixture build | 0 | Turbopack compile/TS/5 static pages/route output 완료, `build-offline-loopback.log` |
| 실제 production HTTP 수집 | 0 | 수집 스크립트의 exit일 뿐 모든 HTTP 성공을 뜻하지 않음, 아래 결과 |

단위/DB 테스트는 권한·가시성 실제 production 모듈을 실행하지만 하네스가 NextAuth 세션과 Next 캐시 API를 mock한다. 역할별 OAuth 실제 로그인과 production HTTP 전체를 검증한 것으로 해석하면 안 된다.

## 6. 원본을 바꾸지 않은 환경 보완과 미해결 조건

**폰트:** `fonts.googleapis.com`의 해당 CSS 요청은 curl에서도 HTTP 403이고 기본 build는 fetch 실패다. 실제 Roboto variable TTF와 OFL을 [Google 공식 google/fonts](https://github.com/google/fonts/tree/main/ofl/roboto)에서 다운로드했다. 별도 CSS response fixture가 300/400/500/700 weight를 정의하고 일시적인 `127.0.0.1:8765` HTTP로 실제 bytes를 공급한다. Next 내부 `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` 테스트 hook을 쓴 **환경 전용 오프라인 빌드**이며 원래 Google CSS의 동일성을 보장하지 않는다. 기본 빌드는 네트워크 조건을 해결하기 전 여전히 blocked다.

최종 `.next/static/media/*.ttf`와 원본 다운로드는 모두 다음 SHA다:
`d7598e12c5dbef095ff8272cfc55da0250bd07fbdecbac8a530b9b277872a134`.
local 파일 URL을 직접 지정했던 실패도 보존했고 성공 보완은 `build-offline.sh`, `font-responses.cjs`다. 폰트 HTTP 서버는 빌드 종료 시 정지했다. 실제 프로젝트 설정·Roboto import·OAuth·권한 코드는 수정하지 않았다.

**native 탐지:** Linux `spawnSync('command',['-v','node'])`는 `ENOENT`, shell의 `command -v node`는 성공했다. `compat-bin/command` shim은 `-v` 조회만 지원하며 quoting으로 실행 주입을 하지 않는다. shim PATH로 spawnSync 성공을 확인했다. native MariaDB는 설치하지 않았으므로 native DB 전체 하네스를 검증한 것은 아니다. Docker 경로가 실제 사용 경로다.

**npm 설치 훅:** 첫 ci는 esbuild 0.28.2/sharp 0.34.5/unrs-resolver 1.11.1 hook 미승인 경고가 있었다. 설치된 hook을 읽고 별도 `npm-runtime.npmrc`의 고정 버전 allow-scripts와 scoped rebuild로 해결했다. package/lock이나 사용자 전역 설정을 편집하지 않았다. npm 12 업데이트 안내는 받았지만 필요하지 않아 업데이트하지 않았다.

**남겨 둔 경고:** Node module mock ExperimentalWarning, MariaDB io_uring EPERM→libaio fallback, 디스크 DB의 max_open_files 상한(16384, 요청32187). 실패/경고를 숨기거나 커널 보안·한도 설정을 바꾸지 않았고 T-022에 기록했다. Next의 `turbopackFileSystemCacheForDev` 실험 표시도 보존했다.

## 7. 실제 HTTP, 게시, 기존 권한 유지의 한계

production 서버를 `127.0.0.1:3000`에 실제 기동하고 요청한 뒤 정지했다. credentials/세션 mocks를 넣지 않았고 테스트 DB만 사용했다.

| production 익명 HTTP | 실제 응답 |
| --- | --- |
| `/privacy` | 200 HTML |
| `/` / `/tasks` / `/admin` / `/admin/users` / `/admin/database` | 500, NextAuth `NO_SECRET` |
| `/api/auth/session` / `/api/auth/providers` | 500 JSON, 인증 설정 오류 |
| `/api/submission-attachments/999999` | 500, 인증 설정 오류 |

`http-results.json`은 각 status/bytes/content-type를 보존한다. 실제 인증 secret/Google ID·secret은 사용·생성하지 않았다. 따라서 실제 Google 로그인, 로그인된 actor별 HTTP, 인증 없는 정상 redirect/attachment 401의 production 동작은 이번 설정에서 확인할 수 없었다. 브라우저 렌더링/모바일/시각 QA는 미실행이다.

기존 Google OAuth 구현과 role 판단 함수는 변경하지 않았으나, **사용자의 기존 DB role 데이터는 이 fixture DB에 없다**. 기존 역할을 유지한 게시는 적합한 호스팅·기존 OAuth callback/secret 전달·기존 DB 연결 또는 별도 승인된 이전·uploads/logs/DB의 영구 볼륨·백업을 확정해야 한다. 신규 빈 운영 DB로 기존 역할이 유지됐다고 선언할 수 없다.

이번 환경의 제공 메타데이터/사용 가능한 도구에서 외부 접속 URL이나 상시 운영·영구 저장 SLA를 확인하지 못했다. 확인한 URL은 로컬 loopback뿐이다. 추가 공개 터널·포트 노출은 하지 않았다. 향후 플랫폼 URL이 제공돼도 별도의 보장이 없는 한 임시 개발 미리보기로 판단해야 하며, 이번 결과는 게시 완료가 아니다. 호스팅 선택은 별도 진행 중이다.

## 8. 개발 재개와 재현 명령

기존 원본 하네스 `test:db:up`은 원본 compose의 공개 포트 매핑을 사용하므로 이 환경에서는 아래 별도 loopback/disk 보완으로 시작한다. 두 DB 모두 `_test`이며 localhost에만 bind한다. 인증 경로를 사용하려면 호스팅 담당자의 기존 설정 전달이 먼저 필요하다.

```bash
cd /workspace/WBSCowork
source /workspace/wbs-cloud-audit/activate.sh
node --version
npm --version

# 새 설치가 필요한 경우 (현재 이미 설치돼 있음)
npm ci --include=dev
npm run lint
npm run typecheck
npm run check:fsd
npm run test:unit

# 저장해 둔 디스크형 격리 DB 재개: 127.0.0.1:3308
bash /workspace/wbs-cloud-audit/db-disk.sh start
TEST_DB_PORT=3308 npm test -- --require-db
bash /workspace/wbs-cloud-audit/db-disk.sh stop

# 원본 tmpfs 구성 + 루프백 전용 환경 overlay: 3307
docker compose -f docker-compose.test.yml \
  -f /workspace/wbs-cloud-audit/compose.loopback.yml up -d --wait
npm test -- --require-db
docker stop wbs-mariadb-test

# 실제 폰트를 포함한 환경 전용 production build
bash /workspace/wbs-cloud-audit/build-offline.sh

# production 익명 HTTP 재현 (자격증명 없이 같은 NO_SECRET 결과 포함)
python3 /workspace/wbs-cloud-audit/smoke-http.py

# 새로운 측정 시 이름을 바꾸어 기록
python3 /workspace/wbs-cloud-audit/snapshot.py resumed
git diff --check
git status --short
```

개발 서버는 `npm run dev -- --hostname 127.0.0.1`이다. 현재 기본 Google Fonts 다운로드 조건은 미해결이다. 환경 보완이 필요한 개발 세션은 다른 터미널에서 다음을 실행한 뒤 원래 dev 명령에 fixture를 지정한다. localhost 서비스이며 외부 접속을 보장하지 않는다. dev는 이번 작업에서 실행하지 않았다.

```bash
python3 -m http.server 8765 --bind 127.0.0.1 \
  --directory /workspace/wbs-cloud-audit/downloads
# 다른 터미널:
source /workspace/wbs-cloud-audit/activate.sh
cd /workspace/WBSCowork
NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/workspace/wbs-cloud-audit/font-responses.cjs \
  npm run dev -- --hostname 127.0.0.1
```

필요하면 `PATH=/workspace/wbs-cloud-audit/compat-bin:$PATH`로 native 조회 shim만 선택할 수 있다. 설치하지 않은 native mariadbd가 생기는 것은 아니다.

종료 상태: production HTTP/폰트 서버는 정지, DB 컨테이너 2개는 정지·보존, 이미지 1개·디스크 datadir·node_modules·Node26·다운로드·npm 캐시·빌드·테스트 증거는 보존했다. commit/push/deploy/prune/자동 캐시 삭제를 하지 않았다.

## 9. 증거 위치와 측정 방법

`/workspace/wbs-cloud-audit/evidence/`의 baseline/before-install/before-docker-pull/after-docker-pull/before-disk-db/after-disk-db-create/final JSON이 df/du/Docker inventory와 시각을 보존한다. 실행마다 command/cwd/time/seconds/exit_code JSON과 전체 로그를 남겼다. `mariadb-image.json`, `dependency-versions.json`, `artifact-sha256.txt`, DB mount/tmpfs/질의/재기동 비교, HTTP 결과도 있다. 기존 스크립트 출력의 비밀번호는 `(set)`로 마스킹됐으며 fixture에 공개된 테스트값 외 실제 비밀정보를 다루지 않았다.

`snapshot.py`, `run.py`, `write-report.py`로 재현할 수 있다. `du` 상위 폴더 exclusion이 하위 동명 소스 디렉터리까지 제외하지 않도록 최종 측정은 절대 경로 exclusion을 사용했다. 중간 snapshot의 source row에는 `app/admin/logs` 12 KiB가 제외된 값이 있을 수 있어 최종 범주 합계는 final JSON을 사용한다. Docker 구간 잔차는 같은 방식의 중간 snapshot 간 변화량이어서 해당 공통 제외가 상쇄된다.

Node checksum은 checksum 전송과 tar 전송의 동일 공식 HTTPS origin 비교이며 별도 GPG 서명 검증은 실행하지 않았다. 설치·검증을 성공하지 않은 부분을 성공으로 취급하지 않는다.
