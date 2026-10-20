# 두 장기 브랜치 운영과 2026-10-20 정리

## 역할과 게시 출처

| 브랜치 | 대상 | 기본 build | 저장소/기동 |
| --- | --- | --- | --- |
| `main` | Synology NAS용 Node/Next | `node --import tsx scripts/run-next.ts build` | MariaDB + 기존 UPLOAD_DIR/LOG_DIR, native `start` |
| `sites` | ChatGPT Sites용 Vinext/Worker | `vinext build` | 기존 D1 `DB` + R2 `ATTACHMENTS`, 동일 Site ID |

`feat/sites-deployment`의 후속 이름은 `sites`다. 과거 문서의 이 브랜치 이름은 당시 이력을 설명한다. 현행 작업은 `git fetch origin sites && git switch sites && git pull --ff-only origin sites`를 사용한다. main은 동일 방식으로 main을 선택한다. 이 작업은 remote branch ref/소스 통합이며 **NAS 배포나 Sites 재게시가 아니다**.

두 브랜치에서 `build:native`/`build:sites`를 명시적으로 사용할 수 있다. 기본 build만 목표에 맞게 유지한다. 공통 기능 수정은 완료된 작은 patch를 다른 브랜치에 이식하고 검증한다. 전체 merge로 기본 build·인증 URL·DB/업로드/로그 경계를 덮어쓰지 않는다. `.env*`, 운영 DB, 사용자 권한, Site 공개 범위는 브랜치 간 복사 대상이 아니다.

Sites project는 `appgprj_6ac75dba14348191801b002e0f2a0937`이고 URL은 https://wbscowork.cometgnome.chatgpt.site 이다. 현재 live는 version12/source `0d1a1a3afe8680ddd7c1281b583fd9d846cc0bc1`, version ID `appgprj_6ac75dba14348191801b002e0f2a0937~appgver_18e1378ab8f48191a6697fc282cd9022`, deployment `appgdep_6ad701611af48191b37ff6b4a1548d2c`다. `sites` branch HEAD의 문서 commit과 live source SHA는 다를 수 있다. GitHub의 `sites`와 Sites 서비스의 별도 source repository `main`을 혼동하지 않는다. 후자의 이름/HEAD·게시·credential·audience·환경은 이번 정리에서 바꾸지 않는다. 향후 명시적으로 승인된 게시 작업만 GitHub sites의 검증 SHA를 공식 source 흐름에 전달해 save/deploy한다.

## 임시 브랜치와 복구

1. 대상(`main`/`sites`)의 깨끗한 최신 상태에서 `fix/<task>` 또는 `feat/<task>`를 임시 생성한다. 관련 열린 PR/CI/배포 연결을 확인한다.
2. 검증 후 적절한 장기 브랜치에 fast-forward 또는 검토한 patch로 반영한다. 운영 배포는 별도 요청 범위다. NAS의 migration은 백업·쓰기 중지·운영자 명시 실행을 유지한다.
3. 양쪽 commit ancestry와 `git cherry -v`/stable patch-id를 조사한다. patch-id가 다르다고 무조건 고유 기능으로 보거나 같다고 문서까지 같다고 보지 않는다. 필요한 경우 app/src/script와 환경별 문서를 나누어 실제 diff를 확인한다.
4. 임시 브랜치의 정확한 마지막 SHA를 충돌 없는 `archive/branches/<date>/<branch>-<short-sha>` annotated tag로 보존하고 **원격 tag의 peeled commit을 먼저 확인**한다. 새 commit이 생겼다면 재조사한다. 미완성·충돌 의도·열린 PR/보호/배포 연결이 있으면 손실시키지 않고 결정할 부분만 보고한다.
5. 반영·보존 확인 후 임시 remote branch만 일반 push-delete한다. 강제 push, 보호 변경, tag 삭제는 하지 않는다. 삭제 직전 Git pre-push 검사로 remote가 조사한 SHA에서 바뀌지 않았는지 확인한다.

복구 예(archive tag는 삭제하지 않는다):

```bash
git fetch origin refs/tags/archive/branches/2026-10-20/fix/shared-desktop-layout-3f62450:refs/tags/archive/branches/2026-10-20/fix/shared-desktop-layout-3f62450
git branch restore/shared-desktop-layout archive/branches/2026-10-20/fix/shared-desktop-layout-3f62450^{commit}
git push origin restore/shared-desktop-layout:refs/heads/restore/shared-desktop-layout
```

기존 branch명이 비어 있고 정확히 그 이름으로 복구해야 할 때만 마지막 ref를 해당 이름으로 바꾼다. 다른 사람이 같은 이름을 사용 중이면 force하지 않는다. 아래 archive는 original main도 포함해 정리 전 모든 tip을 보존한다.

## 조사 시점의 원격 6개와 반영 매핑

비교 기준 main=`089151345f4221fb11e7c07adafc8748d571e319`, 게시용=`31ad5cfa6db31051a26cc72f475e48b7540eeb8d`. GitHub default는 main, 6개 모두 protected=false, ruleset0, open PR0, Actions run0, 게시용 마지막 SHA check-run0이었다. 단순 status의 `pending/statuses=[]`는 실행 중 CI가 아니라 등록된 status가 없는 결과다. 저장소 `.github/workflows`와 자동 배포 script는 없다. 별도 Sites source는 explicit save/deploy 구조다. 연결 도구는 workflow/deployment 관리 collection 일부를 제공하지 않고 gh API는 Forbidden이어서 외부 webhook 설정 전체가 없다고 보장하지 않는다. 관찰한 자동 배포 연결이나 열린 PR/보호 충돌은 없었으며 설정을 변경하지 않는다.

| 이전 branch | 마지막 SHA / 마지막 commit | 조사 시 main 대비 | 조사 시 feat/sites-deployment 대비 | 처리 |
| --- | --- | --- | --- | --- |
| `feat/bug-screenshots` | `31ad5cfa6db31051a26cc72f475e48b7540eeb8d` · docs: record verified screenshot publication and QA limits | 1 behind / 7 ahead, 미포함 | 동일 tip, 전부 포함 | 검증된 원문/첨부 기능과 공통 테스트·문서를 main에 선택 이식; sites에 원래 history 보존, tag 후 삭제 |
| `feat/sites-deployment` | `31ad5cfa6db31051a26cc72f475e48b7540eeb8d` · docs: record verified screenshot publication and QA limits | 1 behind / 7 ahead, 미포함 | 기준 tip | 최신31ad5cf를 sites가 원래 ancestry 그대로 이어받고 tag 후 옛 이름 삭제 |
| `fix/shared-desktop-layout` | `3f624501d942db22ab0cb3df699de036b3b2a43c` · fix(ui): align shared containers and prevent navigation wrapping | 0 behind / 1 ahead, 미포함 | 7 behind / 2 ahead, commit ancestry 미포함 | main은3f62450로 fast-forward. sites는0a2cbb5의 app/src/scripts/package patch가 동일; native 기본 build commit은 main 전용. tag 후 삭제 |
| `fix/shared-desktop-layout-sites` | `ad19c05d351de967ee282389d689ffaeb14e3122` · docs: require explicit per-task request before publishing | 1 behind / 3 ahead, 미포함 | 4 behind / 0 ahead, 전부 ancestor | sites에 전부 포함. strict 게시 승인 규칙/공통 화면은 main에도 내용 반영; tag 후 삭제 |
| `fix/sites-test-network-diagnostics` | `de3e005d106c31d0e7f415b9eae9602856da54db` · docs: record approved host and supported environment settings path | 1 behind / 5 ahead, 미포함 | 2 behind / 0 ahead, 전부 ancestor | sites에 전부 포함. loopback guard·익명 smoke·문서도 main에 선택 이식; tag 후 삭제 |
| `main` | `089151345f4221fb11e7c07adafc8748d571e319` · chore(nas): integrate team workflow with native main defaults | 동일 tip | 7 behind / 1 ahead, native 기본 build/운영 문서 고유 | 유지. NAS 기본 build/start/명시 migration/문서 보존. 공통 완료 변경만 반영 |

전체 commit 기준 `git cherry -v`에서는 divergent commit이 모두 `+`였고 patch-equivalent(`-`) commit은 없었다. 다만 UI3f62450와 Sites0a2cbb5는 문서 기준선이 달라 전체 patch-id는 다르고, **app/src/scripts/package 범위 stable patch-id는 둘 다 `2daf58344eab928f18612091412eaa23c204eec7`**이다. 실제 runtime/test diff도 같아서 레이아웃 기능이 누락됐다고 판단하지 않았다. main-only0891513은 native build 기본값·NAS 안내를 변경하며 sites에 전체 적용하지 않는다.

main에는3f62450 ancestry를 그대로 반영한 뒤31ad5cf의 검증된 공통 app/src/db/drizzle/scripts/tests/.gitignore를 정확히 이식한다. dependencies/lockfile/runtime config·native script는 그대로다. 충돌은 환경별 문서/기본 build에서만 해소하고 NAS guide·기존 native 검증 기록을 보존한다. Sites 게시 이력eed6ff9/ad19c05의 현재 유효한 strict 정책/증거 문서는 반영하되 superseded 자동 게시 문구를 되살리지 않는다. 고유 미완성 app 변경은 발견하지 않았다. 알려진 QLT-019/016/020/021과 OPS 미해결은 계속 명시한다.

## archive 태그

| 이전 branch | 원격 archive tag (annotated, peeled SHA 위 표와 일치) |
| --- | --- |
| `feat/bug-screenshots` | `archive/branches/2026-10-20/feat/bug-screenshots-31ad5cf` |
| `feat/sites-deployment` | `archive/branches/2026-10-20/feat/sites-deployment-31ad5cf` |
| `fix/shared-desktop-layout` | `archive/branches/2026-10-20/fix/shared-desktop-layout-3f62450` |
| `fix/shared-desktop-layout-sites` | `archive/branches/2026-10-20/fix/shared-desktop-layout-sites-ad19c05` |
| `fix/sites-test-network-diagnostics` | `archive/branches/2026-10-20/fix/sites-test-network-diagnostics-de3e005` |
| `main` | `archive/branches/2026-10-20/main-0891513` |

## 검증과 운영 영향

정리 전 archive6개를 원격에 push하고 각 peeled SHA를 확인했다. 공통 source 경로는 main과 original31ad5cf의 byte 차이0을 확인한다. Native build 기본값/CLI, Sites build 기본값, 타입/lint/FSD, 네트워크12/첨부D1R228을 확인한다. 기존 실패 baseline과 native build/최종 refs 실제 결과는 완료 기록으로 보강한다. 공통 앱이 동일하므로 이전 version12의 HTTP248/버그D158/Chromium19/layout48/native additive99 결과는 동일 source evidence로 재사용하며 운영 인수로 바꾸지 않는다.

Native v9는 소스에 포함하지만 실제 NAS DB에 적용하지 않는다. 기존 사용자의 role/원문/파일 보존과 명시 migration gate는 유지한다. QLT-020의 첨부 있는 native 제보 purge는 durable 정리까지 fail-closed다. 사이트 version12/public/env revision11/운영 데이터를 유지하고 새 source credential/save/deploy 호출을 하지 않는다. 운영 브라우저는 과거 CONNECT403 한계와 부모의 별도 확인 범위를 유지한다.

main 통합 검증: 기본 `npm run build`(native Turbopack) exit0, CLI8 PASS, lint0/0·typecheck·FSD5/위반0, network12/첨부D1R228 PASS. 기존 Node 단위105/108 실패3건은 QLT-019, DB suite는3307 미기동/ECONNREFUSED로 미실행이다. native build의 logging 동적 경로 NFT 경고1건은 기존 OPS-021로 남긴다. main next.config/run-next·start script와 dependency/lockfile은 original0891513과 동일하다.
