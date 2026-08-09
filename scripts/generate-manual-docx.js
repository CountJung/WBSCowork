#!/usr/bin/env node

/**
 * WBSCowork 상세 사용설명서 Word 문서 생성 스크립트
 *
 * 사용법:
 *   node scripts/generate-manual-docx.js
 *
 * 필수 설치:
 *   npm install --save-dev docx
 *
 * 출력:
 *   scripts/outputs/WBSCowork_UserManual.docx
 */

const {
    Document, Packer, Paragraph, TextRun,
    AlignmentType, Table, TableRow, TableCell, WidthType,
    BorderStyle, ImageRun, convertInchesToTwip,
    ShadingType
} = require('docx');
const fs = require('fs');
const path = require('path');

const SCREENSHOT = path.resolve(__dirname, '../docs/screenshots/2026-04-27 100004.png');

// ─── 스타일 헬퍼 ──────────────────────────────────────────────────────────────

function h1(text) {
    return new Paragraph({
        children: [new TextRun({ text, bold: true, size: 40, color: '3D2B2B', font: 'Georgia' })],
        spacing: { before: 480, after: 200 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'E8B4B8' } }
    });
}

function h2(text) {
    return new Paragraph({
        children: [new TextRun({ text, bold: true, size: 30, color: '7A5C5C' })],
        spacing: { before: 360, after: 160 }
    });
}

function h3(text) {
    return new Paragraph({
        children: [new TextRun({ text, bold: true, size: 24, color: 'A49393' })],
        spacing: { before: 240, after: 120 }
    });
}

function body(text) {
    return new Paragraph({
        children: [new TextRun({ text, size: 22, color: '3D2B2B' })],
        spacing: { after: 120 }
    });
}

function bullet(text, level) {
    return new Paragraph({
        children: [new TextRun({ text, size: 22, color: '3D2B2B' })],
        bullet: { level: level || 0 },
        spacing: { after: 80 }
    });
}

function note(text) {
    return new Paragraph({
        children: [new TextRun({ text: '💡  ' + text, size: 20, color: 'A49393', italics: true })],
        spacing: { after: 120 },
        indent: { left: convertInchesToTwip(0.3) }
    });
}

function divider() {
    return new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'EED6D3' } },
        spacing: { before: 240, after: 240 }
    });
}

function tableRow(cells, isHeader) {
    return new TableRow({
        children: cells.map(function(cell) {
            return new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({
                        text: cell,
                        size: isHeader ? 22 : 20,
                        bold: isHeader,
                        color: isHeader ? 'FFFFFF' : '3D2B2B'
                    })],
                    spacing: { after: 60 }
                })],
                shading: isHeader ? { fill: 'A49393', type: ShadingType.CLEAR, color: 'auto' } : undefined
            });
        })
    });
}

// ─── 섹션들 ───────────────────────────────────────────────────────────────────

function section01_Overview() {
    var items = [
        h1('1. WBSCowork 개요'),
        body('WBSCowork는 WBS(Work Breakdown Structure) 기반의 태스크 협업 시스템입니다. 간트 차트로 일정을 시각화하고, 각 태스크에 산출물을 등록·공유하며, 댓글로 팀원과 소통합니다.'),
        h2('1.1 핵심 기능'),
        bullet('WBS 간트 차트: 프로젝트의 모든 태스크를 주·일·월 단위로 시각적으로 표시합니다.', 0),
        bullet('태스크 단위 산출물: 각 WBS 항목에 Markdown 내용과 첨부파일을 등록합니다.', 0),
        bullet('댓글 기반 협업: 제출물에 피드백, 보완 요청, 승인 의견을 남깁니다.', 0),
        bullet('역할 기반 접근 제어: 4단계 역할(슈퍼관리자/관리자/일반사용자/게스트)로 권한을 세분화합니다.', 0),
        h2('1.2 기술 스택'),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                tableRow(['영역', '기술'], true),
                tableRow(['프레임워크', 'Next.js 16 App Router, TypeScript'], false),
                tableRow(['UI', 'MUI (Material UI)'], false),
                tableRow(['인증', 'NextAuth v4 (Google OAuth)'], false),
                tableRow(['DB', 'MariaDB (mariadb npm pool)'], false),
                tableRow(['차트', 'frappe-gantt'], false),
                tableRow(['데이터 조회', 'TanStack Query (클라이언트), Server Components (서버)'], false),
            ]
        }),
    ];
    return items;
}

function section02_Start() {
    return [
        divider(),
        h1('2. 시작하기'),
        h2('2.1 로그인'),
        body('WBSCowork는 Google OAuth 인증을 사용합니다.'),
        bullet('메인 페이지(/) 접속', 0),
        bullet('"Google로 로그인" 버튼 클릭', 0),
        bullet('Google 계정 선택 및 권한 허용', 0),
        bullet('최초 로그인 시 guest 역할로 등록됩니다 — 관리자에게 member 역할 부여를 요청하세요.', 0),
        note('역할이 guest인 경우 태스크 작성 및 제출물 등록이 불가합니다. /admin/users에서 관리자가 역할을 변경합니다.'),
        h2('2.2 메인 화면 구성'),
        bullet('상단 앱바: 프로젝트 선택, 테마 전환, 로그아웃', 0),
        bullet('프로젝트 선택 드롭다운: 여러 프로젝트 전환 가능', 0),
        bullet('간트 차트 영역: 선택된 프로젝트의 WBS 태스크를 타임라인으로 표시', 0),
        bullet('태스크 카드 영역: 각 태스크의 제출물, 댓글 패널 포함', 0),
        note('간트 차트의 태스크 바를 클릭하면 팝업이 열리고, "업무 열기" 버튼으로 해당 태스크로 바로 이동합니다.'),
    ];
}

function section03_Task() {
    return [
        divider(),
        h1('3. 태스크 관리'),
        h2('3.1 태스크 생성'),
        bullet('홈 화면의 "새 태스크" 버튼 클릭', 0),
        bullet('태스크 제목 입력 (필수)', 0),
        bullet('시작일 · 종료일 설정', 0),
        bullet('상위 태스크 지정 (선택, 계층 구조 구성 시)', 0),
        bullet('담당자 지정 (선택)', 0),
        bullet('"저장" 버튼 클릭', 0),
        h2('3.2 태스크 수정'),
        body('간트 차트의 태스크 바를 클릭하면 팝업이 열립니다. 팝업에서 제목, 날짜, 진행률을 확인하고 "업무 열기"로 상세 편집 화면으로 이동합니다.'),
        h2('3.3 간트 차트 조작'),
        bullet('Day / Week / Month 탭: 시간 단위 전환', 0),
        bullet('태스크 바 드래그: 일정 이동 (마우스로 바를 끌어 날짜 변경)', 0),
        bullet('태스크 바 우클릭 또는 클릭: 태스크 팝업 열기', 0),
        bullet('연결선: 상위-하위 태스크 의존성 표시', 0),
        note('간트 차트의 날짜 범위는 프로젝트의 전체 태스크 기간에 맞춰 자동으로 조정됩니다.'),
    ];
}

function section04_Submission() {
    return [
        divider(),
        h1('4. 산출물 제출'),
        h2('4.1 새 제출 등록'),
        body('태스크 카드 하단의 제출물 패널에서 산출물을 등록합니다.'),
        bullet('태스크 카드에서 "제출물" 패널 확인', 0),
        bullet('"새 제출 내용" 텍스트 필드에 Markdown 형식으로 내용 작성', 0),
        bullet('공개 범위 선택 (공개 / 비공개)', 0),
        bullet('파일 첨부 (선택): 드래그 앤 드롭 또는 클릭하여 파일 선택', 0),
        bullet('"제출 등록" 버튼 클릭', 0),
        h2('4.2 파일 첨부'),
        body('데스크탑에서는 드래그 앤 드롭으로 파일을 업로드할 수 있습니다. 첨부 영역에 파일을 끌어다 놓으면 자동으로 선택됩니다. 여러 파일을 동시에 선택 가능합니다. 모바일에서는 "파일 선택" 버튼을 사용합니다.'),
        note('이미지와 PDF 파일은 "미리보기" 버튼으로 인라인 미리보기가 가능합니다.'),
        h2('4.3 공개 범위'),
        body('제출 시 공개 범위를 설정하면 정보 접근을 제어할 수 있습니다.'),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                tableRow(['공개 범위', '조회 가능한 사용자'], true),
                tableRow(['공개 (public)', '모든 로그인 사용자'], false),
                tableRow(['비공개 (private)', '작성자 본인, 관리자, 슈퍼관리자'], false),
            ]
        }),
        new Paragraph({ spacing: { after: 160 } }),
        h2('4.4 제출물 수정 및 삭제'),
        bullet('수정: 제출물 카드 하단의 "제출 수정" 폼에서 내용 변경 후 저장', 0),
        bullet('삭제: "제출 삭제" 버튼 (작성자 본인과 관리자만 가능)', 0),
        bullet('첨부파일 추가: 수정 폼의 파일 첨부 영역을 사용', 0),
        bullet('첨부파일 삭제: 첨부파일 목록의 "삭제" 버튼 클릭', 0),
    ];
}

function section05_Comment() {
    return [
        divider(),
        h1('5. 댓글 및 협업'),
        h2('5.1 댓글 작성'),
        body('각 제출물 카드의 댓글 섹션에서 피드백을 남길 수 있습니다.'),
        bullet('"새 댓글" 텍스트 필드에 내용 입력 (Markdown 지원)', 0),
        bullet('"댓글 등록" 버튼 클릭', 0),
        note('댓글은 Markdown 문법을 지원합니다. 체크리스트(-[ ] 항목), 코드 블록(```), 링크([텍스트](URL))를 사용할 수 있습니다.'),
        h2('5.2 댓글 수정 및 삭제'),
        bullet('수정: 댓글 하단의 수정 폼에서 내용 변경 후 "댓글 수정" 클릭', 0),
        bullet('삭제: "댓글 삭제" 버튼 (작성자 본인과 관리자만 가능)', 0),
        h2('5.3 협업 모범 사례'),
        bullet('제출물 제목과 내용을 명확하게 작성하여 검토자가 쉽게 이해할 수 있게 합니다.', 0),
        bullet('파일 첨부 시 버전 정보를 포함하세요 (예: v1.0, Draft_2).', 0),
        bullet('댓글은 구체적이고 건설적으로 작성합니다.', 0),
        bullet('비공개 제출물은 내부 검토가 필요한 민감한 정보에만 사용합니다.', 0),
    ];
}

function section06_Roles() {
    return [
        divider(),
        h1('6. 역할 및 권한'),
        h2('6.1 역할 종류'),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                tableRow(['역할', '식별', '주요 권한'], true),
                tableRow(['슈퍼관리자', 'isSuperuser (환경변수)', 'DB/설정/사용자 관리 포함 모든 권한'], false),
                tableRow(['관리자', 'role = admin', '/admin 접근, 사용자 역할 부여, 비공개 제출물 조회'], false),
                tableRow(['일반사용자', 'role = member', '태스크·제출물·댓글 CRUD, 공개+본인 비공개 조회'], false),
                tableRow(['게스트', 'role = guest', '공개 제출물 읽기 전용, 권한 승급 대기'], false),
            ]
        }),
        new Paragraph({ spacing: { after: 160 } }),
        h2('6.2 역할 변경 방법'),
        body('관리자는 /admin/users 페이지에서 사용자 역할을 변경할 수 있습니다.'),
        bullet('상단 앱바 → 관리자 메뉴 → 사용자 관리', 0),
        bullet('변경할 사용자를 찾아 역할 드롭다운 선택', 0),
        bullet('"저장" 클릭', 0),
        note('관리자는 guest와 member 역할만 부여할 수 있습니다. admin 역할은 슈퍼관리자만 부여 가능합니다.'),
        h2('6.3 슈퍼관리자 설정'),
        body('슈퍼관리자는 환경변수 SUPERUSER_EMAIL에 이메일 주소를 지정하여 설정합니다. 서버 재시작 없이는 변경이 반영되지 않습니다.'),
    ];
}

function section07_Admin() {
    return [
        divider(),
        h1('7. 관리자 패널'),
        h2('7.1 접근 방법'),
        body('앱바 우측 상단의 "관리자" 메뉴에서 각 관리 페이지로 이동합니다.'),
        h2('7.2 페이지별 안내'),
        h3('/admin — 개요 대시보드'),
        body('전체 제출물 현황, 사용자 통계, 최근 활동을 한눈에 확인합니다. 관리자 이상 접근 가능.'),
        h3('/admin/users — 사용자 관리'),
        body('등록된 사용자 목록과 역할 현황을 확인하고, 역할을 변경합니다. 관리자 이상 접근 가능.'),
        h3('/admin/database — DB 관리'),
        body('데이터베이스 테이블 생성, 초기화, 마이그레이션을 수행합니다. 슈퍼관리자 전용.'),
        h3('/admin/logs — 서버 로그'),
        body('서버 로그를 실시간으로 조회하고 에러를 추적합니다. 슈퍼관리자 전용.'),
        h3('/admin/settings — 시스템 설정'),
        body('환경변수를 웹 UI에서 편집합니다. 변경 사항은 .env 파일에 저장됩니다. 슈퍼관리자 전용.'),
        note('환경변수 변경 후 서버를 재시작해야 적용됩니다.'),
    ];
}

function section08_Tips() {
    return [
        divider(),
        h1('8. 유용한 팁'),
        h2('8.1 키보드 단축키 & UX'),
        bullet('간트 차트 Date 범위: Day / Week / Month 탭 클릭으로 전환', 0),
        bullet('태스크 팝업: 간트 바 클릭 후 "업무 열기"로 직접 이동', 0),
        bullet('다크 모드: 앱바의 테마 전환 버튼으로 즉시 전환 가능', 0),
        h2('8.2 Markdown 활용'),
        body('제출물과 댓글 본문에서 Markdown 문법을 사용할 수 있습니다:'),
        bullet('# 제목, ## 소제목', 0),
        bullet('**굵게**, *기울임*', 0),
        bullet('- [ ] 체크리스트 항목', 0),
        bullet('```코드 블록```', 0),
        bullet('[링크 텍스트](URL)', 0),
        h2('8.3 첨부파일 미리보기'),
        body('이미지(JPG, PNG, GIF 등)와 PDF 파일은 별도 다운로드 없이 인라인으로 미리볼 수 있습니다. 첨부파일 목록에서 "미리보기" 버튼을 클릭하세요.'),
        h2('8.4 자주 묻는 질문'),
        h3('Q. 로그인 후 아무것도 할 수 없어요.'),
        body('A. 최초 로그인 시 guest 역할이 부여됩니다. 관리자에게 member 역할 부여를 요청하세요.'),
        h3('Q. 파일 업로드 용량 제한이 있나요?'),
        body('A. 기본값은 환경변수 UPLOAD_MAX_FILE_SIZE_MB로 설정합니다. 관리자에게 확인하세요.'),
        h3('Q. 비공개 제출물을 나중에 공개로 바꿀 수 있나요?'),
        body('A. 예, 제출물 수정 폼에서 공개 범위를 언제든지 변경할 수 있습니다.'),
        h3('Q. 간트 차트에서 태스크 순서를 바꿀 수 있나요?'),
        body('A. 현재 버전에서는 생성 순서로 표시됩니다. 태스크 편집 화면에서 상위 태스크와 날짜를 조정해 시각적 순서를 구성하세요.'),
    ];
}

function buildDocument() {
    var children = [];

    // 타이틀 페이지
    children.push(new Paragraph({ spacing: { before: 1200 } }));
    children.push(new Paragraph({
        children: [new TextRun({ text: 'WBSCowork', bold: true, size: 80, color: '3D2B2B', font: 'Georgia' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 }
    }));
    children.push(new Paragraph({
        children: [new TextRun({ text: '사용설명서', size: 40, color: '7A5C5C', italics: true })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 }
    }));
    children.push(new Paragraph({
        children: [new TextRun({ text: '태스크 기반 산출물 협업 시스템 완전 가이드', size: 24, color: 'A49393' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 480 }
    }));
    children.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: 'E8B4B8' } },
        spacing: { after: 480 }
    }));

    // 스크린샷 (있을 경우)
    if (fs.existsSync(SCREENSHOT)) {
        var imgData = fs.readFileSync(SCREENSHOT);
        children.push(new Paragraph({
            children: [new ImageRun({
                data: imgData,
                transformation: { width: 620, height: 390 },
                altText: { name: '간트 차트 화면', description: 'WBSCowork 간트 차트 스크린샷' }
            })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 }
        }));
        children.push(new Paragraph({
            children: [new TextRun({ text: '▲ WBS 간트 차트 화면 — 태스크 팝업에서 직접 업무 이동 가능', size: 18, color: 'A49393', italics: true })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 480 }
        }));
    }

    // 본문 섹션
    [
        section01_Overview(),
        section02_Start(),
        section03_Task(),
        section04_Submission(),
        section05_Comment(),
        section06_Roles(),
        section07_Admin(),
        section08_Tips(),
    ].forEach(function(section) {
        section.forEach(function(item) { children.push(item); });
    });

    return new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: convertInchesToTwip(1.0),
                        right: convertInchesToTwip(1.0),
                        bottom: convertInchesToTwip(1.0),
                        left: convertInchesToTwip(1.0)
                    }
                }
            },
            children: children
        }]
    });
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('\uD83D\uDCDD WBSCowork 상세 사용설명서 Word 문서 생성 중...\n');

    var doc = buildDocument();
    var outputDir = path.join(__dirname, 'outputs');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    var outputPath = path.join(outputDir, 'WBSCowork_UserManual.docx');

    var buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, buffer);

    console.log('\u2705 완료!');
    console.log('\uD83D\uDCC4 파일: ' + outputPath);
    console.log('\uD83D\uDCF8 스크린샷: ' + (fs.existsSync(SCREENSHOT) ? '포함' : '미포함'));
}

main().catch(function(err) {
    console.error('오류:', err);
    process.exit(1);
});
