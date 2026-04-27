#!/usr/bin/env node

/**
 * WBSCowork 사용설명서 PowerPoint 생성 스크립트
 *
 * 사용법:
 *   node scripts/convert-manual-to-pptx.js
 *
 * 필수 설치:
 *   npm install --save-dev pptxgenjs
 */

const pptxgen = require('pptxgenjs');
const fs = require('fs');
const path = require('path');

// ─── Warm Blush 팔레트 ───────────────────────────────────────────────────────
const C = {
    cream:   'FAF7F2',
    blush:   'EED6D3',
    rose:    'E8B4B8',
    mauve:   'A49393',
    dark:    '3D2B2B',
    accent:  '7A5C5C',
    white:   'FFFFFF',
    divider: 'D4B8B8',
    lightBg: 'FDF4F4',
};

const SCREENSHOT = path.resolve(__dirname, '../docs/screenshots/2026-04-27 100004.png');

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function addHeader(slide, pptx, title, subtitle) {
    slide.background = { color: C.cream };

    slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: 0.08,
        fill: { color: C.rose },
        line: { color: C.rose }
    });

    slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0.08, w: '100%', h: 1.0,
        fill: { color: C.blush },
        line: { color: C.blush }
    });

    slide.addText(title, {
        x: 0.5, y: 0.15, w: 9, h: 0.6,
        fontSize: 28, bold: true, color: C.dark,
        fontFace: 'Georgia'
    });

    if (subtitle) {
        slide.addText(subtitle, {
            x: 0.5, y: 0.72, w: 9, h: 0.32,
            fontSize: 12, color: C.mauve, italic: true
        });
    }
}

function addFooter(slide, pageNum) {
    slide.addText('WBSCowork  \u00b7  ' + pageNum, {
        x: 0, y: 5.0, w: '100%', h: 0.22,
        fontSize: 9, color: C.mauve, align: 'right',
        margin: [0, 0.3, 0, 0]
    });
}

// ─── 슬라이드 함수들 ──────────────────────────────────────────────────────────

function slide01_Title(pptx) {
    const s = pptx.addSlide();
    s.background = { color: C.cream };

    s.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: 3.6, h: '100%',
        fill: { color: C.blush },
        line: { color: C.blush }
    });
    s.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: 3.6, h: 0.12,
        fill: { color: C.rose },
        line: { color: C.rose }
    });

    s.addText('WBSCowork', {
        x: 0.35, y: 1.3, w: 3.0, h: 1.0,
        fontSize: 42, bold: true, color: C.dark,
        fontFace: 'Georgia'
    });
    s.addText('태스크 기반\n산출물 협업 플랫폼', {
        x: 0.35, y: 2.35, w: 3.0, h: 1.0,
        fontSize: 15, color: C.accent, italic: true
    });

    s.addShape(pptx.ShapeType.line, {
        x: 3.9, y: 0.6, w: 0, h: 4.0,
        line: { color: C.divider, width: 1.5 }
    });

    s.addText('핵심 기능 3가지', {
        x: 4.2, y: 0.9, w: 5.5, h: 0.45,
        fontSize: 13, bold: true, color: C.mauve
    });

    const features = [
        ['WBS 간트 차트', '업무 일정을 시각적으로 계획 및 추적'],
        ['태스크 단위 산출물', '각 업무에 결과물을 체계적으로 등록'],
        ['댓글 기반 협업', '제출물에 피드백 · 검토 의견 공유'],
    ];

    features.forEach(function(f, i) {
        var y = 1.55 + i * 1.05;
        s.addShape(pptx.ShapeType.roundRect, {
            x: 4.2, y: y, w: 5.5, h: 0.88,
            fill: { color: C.white },
            line: { color: C.divider, width: 1 },
            rectRadius: 0.08
        });
        s.addText(f[0], {
            x: 4.4, y: y + 0.05, w: 5.1, h: 0.3,
            fontSize: 14, bold: true, color: C.dark
        });
        s.addText(f[1], {
            x: 4.4, y: y + 0.4, w: 5.1, h: 0.35,
            fontSize: 11, color: C.mauve
        });
    });

    addFooter(s, 1);
}

function slide02_GanttDemo(pptx) {
    var s = pptx.addSlide();
    addHeader(s, pptx, '간트 차트 핵심 기능', 'WBS 항목 클릭 → 팝업에서 바로 업무 이동');

    if (fs.existsSync(SCREENSHOT)) {
        s.addImage({
            path: SCREENSHOT,
            x: 0.4, y: 1.25, w: 9.2, h: 3.35
        });
        s.addShape(pptx.ShapeType.rect, {
            x: 0.4, y: 1.25, w: 9.2, h: 3.35,
            fill: { type: 'none' },
            line: { color: C.divider, width: 1.5 }
        });
    } else {
        s.addShape(pptx.ShapeType.roundRect, {
            x: 0.4, y: 1.25, w: 9.2, h: 3.35,
            fill: { color: C.lightBg },
            line: { color: C.divider }
        });
        s.addText('[간트 차트 스크린샷]', {
            x: 0.4, y: 2.6, w: 9.2, h: 0.5,
            fontSize: 16, color: C.mauve, align: 'center'
        });
    }

    s.addText('WBS 항목 클릭 시 팝업이 열리고 "업무 열기" 버튼으로 해당 태스크 산출물 영역으로 바로 이동합니다.', {
        x: 0.4, y: 4.65, w: 9.2, h: 0.3,
        fontSize: 10, color: C.mauve, italic: true, align: 'center'
    });

    addFooter(s, 2);
}

function slide03_Roles(pptx) {
    var s = pptx.addSlide();
    addHeader(s, pptx, '역할 시스템', '4단계 권한으로 정보 접근 범위를 정확히 제어');

    var roles = [
        { name: '슈퍼관리자', badge: 'isSuperuser', color: C.rose, desc: 'DB 관리 · 환경설정 · 사용자 관리 · 모든 권한' },
        { name: '관리자', badge: 'role = admin', color: C.mauve, desc: '/admin 접근 · 사용자 역할 부여 · 비공개 제출물 조회' },
        { name: '일반사용자', badge: 'role = member', color: C.accent, desc: '태스크·제출물·댓글 CRUD · 공개+본인 비공개 조회' },
        { name: '게스트', badge: 'role = guest', color: C.divider, desc: '공개 제출물 읽기 전용 · 권한 승급 대기' },
    ];

    roles.forEach(function(r, i) {
        var y = 1.2 + i * 0.88;

        s.addShape(pptx.ShapeType.roundRect, {
            x: 0.4, y: y, w: 9.2, h: 0.76,
            fill: { color: i % 2 === 0 ? C.white : C.lightBg },
            line: { color: C.divider, width: 0.8 },
            rectRadius: 0.06
        });
        s.addShape(pptx.ShapeType.rect, {
            x: 0.4, y: y, w: 0.18, h: 0.76,
            fill: { color: r.color },
            line: { color: r.color }
        });
        s.addText(r.name, {
            x: 0.75, y: y + 0.07, w: 2.2, h: 0.32,
            fontSize: 14, bold: true, color: C.dark
        });
        s.addShape(pptx.ShapeType.roundRect, {
            x: 0.75, y: y + 0.41, w: 2.0, h: 0.24,
            fill: { color: C.blush },
            line: { color: C.rose },
            rectRadius: 0.04
        });
        s.addText(r.badge, {
            x: 0.75, y: y + 0.41, w: 2.0, h: 0.24,
            fontSize: 9, color: C.accent, align: 'center', bold: true
        });
        s.addText(r.desc, {
            x: 3.1, y: y + 0.12, w: 6.3, h: 0.5,
            fontSize: 12, color: C.dark, valign: 'middle'
        });
    });

    addFooter(s, 3);
}

function slide04_Visibility(pptx) {
    var s = pptx.addSlide();
    addHeader(s, pptx, '제출물 공개 범위', '공개·비공개 설정으로 정보 접근 범위를 제어합니다');

    // 공개
    s.addShape(pptx.ShapeType.roundRect, {
        x: 0.4, y: 1.2, w: 4.5, h: 3.6,
        fill: { color: C.white },
        line: { color: C.divider, width: 1 },
        rectRadius: 0.1
    });
    s.addShape(pptx.ShapeType.rect, {
        x: 0.4, y: 1.2, w: 4.5, h: 0.5,
        fill: { color: C.rose },
        line: { color: C.rose }
    });
    s.addText('공개 (public)', {
        x: 0.5, y: 1.24, w: 4.3, h: 0.42,
        fontSize: 15, bold: true, color: C.white
    });
    ['모든 인증 사용자가 조회 가능', '로그인한 팀원 전체에게 공유', '기본 권장 설정'].forEach(function(t, i) {
        s.addText(t, {
            x: 0.65, y: 1.92 + i * 0.55, w: 4.0, h: 0.4,
            fontSize: 13, color: C.dark, bullet: true
        });
    });

    // 비공개
    s.addShape(pptx.ShapeType.roundRect, {
        x: 5.1, y: 1.2, w: 4.5, h: 3.6,
        fill: { color: C.white },
        line: { color: C.divider, width: 1 },
        rectRadius: 0.1
    });
    s.addShape(pptx.ShapeType.rect, {
        x: 5.1, y: 1.2, w: 4.5, h: 0.5,
        fill: { color: C.mauve },
        line: { color: C.mauve }
    });
    s.addText('비공개 (private)', {
        x: 5.2, y: 1.24, w: 4.3, h: 0.42,
        fontSize: 15, bold: true, color: C.white
    });
    ['작성자 본인만 조회', '관리자(admin) 조회 가능', '슈퍼관리자 조회 가능'].forEach(function(t, i) {
        s.addText(t, {
            x: 5.25, y: 1.92 + i * 0.55, w: 4.2, h: 0.4,
            fontSize: 13, color: C.dark, bullet: true
        });
    });

    addFooter(s, 4);
}

function slide05_Workflow(pptx) {
    var s = pptx.addSlide();
    addHeader(s, pptx, '산출물 제출 워크플로우', '태스크에서 제출까지 4단계');

    var steps = [
        { num: '01', label: '태스크 열기', desc: '간트 차트 또는 리스트에서 태스크 선택' },
        { num: '02', label: '제출 등록', desc: 'Markdown 내용 작성, 공개 범위 설정' },
        { num: '03', label: '파일 첨부', desc: '드래그 드롭 또는 클릭으로 파일 업로드' },
        { num: '04', label: '댓글 협업', desc: '팀원 피드백 · 보완 요청 · 승인 의견' },
    ];

    s.addShape(pptx.ShapeType.line, {
        x: 1.1, y: 2.55, w: 7.8, h: 0,
        line: { color: C.divider, width: 2 }
    });

    steps.forEach(function(st, i) {
        var x = 0.5 + i * 2.3;

        s.addShape(pptx.ShapeType.ellipse, {
            x: x + 0.45, y: 2.1, w: 0.75, h: 0.75,
            fill: { color: C.rose },
            line: { color: C.rose }
        });
        s.addText(st.num, {
            x: x + 0.45, y: 2.1, w: 0.75, h: 0.75,
            fontSize: 16, bold: true, color: C.white, align: 'center', valign: 'middle'
        });
        s.addText(st.label, {
            x: x, y: 3.05, w: 2.0, h: 0.42,
            fontSize: 13, bold: true, color: C.dark, align: 'center'
        });
        s.addText(st.desc, {
            x: x, y: 3.5, w: 2.0, h: 0.72,
            fontSize: 11, color: C.mauve, align: 'center'
        });
    });

    addFooter(s, 5);
}

function slide06_Admin(pptx) {
    var s = pptx.addSlide();
    addHeader(s, pptx, '관리자 패널', '/admin 대시보드 — 역할에 따라 접근 범위가 다릅니다');

    var items = [
        { path: '/admin', who: '관리자+', desc: '전체 제출물 현황 · 사용자 통계' },
        { path: '/admin/users', who: '관리자+', desc: 'guest·member 역할 부여 및 계정 관리' },
        { path: '/admin/database', who: '슈퍼관리자', desc: 'DB 테이블 생성 · 초기화' },
        { path: '/admin/logs', who: '슈퍼관리자', desc: '서버 로그 조회 · 에러 추적' },
        { path: '/admin/settings', who: '슈퍼관리자', desc: '환경변수 편집 · 시스템 설정' },
    ];

    items.forEach(function(it, i) {
        var y = 1.22 + i * 0.72;
        s.addShape(pptx.ShapeType.roundRect, {
            x: 0.4, y: y, w: 9.2, h: 0.62,
            fill: { color: i % 2 === 0 ? C.white : C.lightBg },
            line: { color: C.divider, width: 0.7 },
            rectRadius: 0.05
        });
        s.addText(it.path, {
            x: 0.55, y: y + 0.08, w: 3.3, h: 0.42,
            fontSize: 13, bold: true, color: C.accent, fontFace: 'Courier New'
        });
        var badgeColor = it.who === '슈퍼관리자' ? C.rose : C.mauve;
        s.addShape(pptx.ShapeType.roundRect, {
            x: 4.0, y: y + 0.13, w: 1.6, h: 0.28,
            fill: { color: badgeColor },
            line: { color: badgeColor },
            rectRadius: 0.04
        });
        s.addText(it.who, {
            x: 4.0, y: y + 0.13, w: 1.6, h: 0.28,
            fontSize: 10, color: C.white, bold: true, align: 'center'
        });
        s.addText(it.desc, {
            x: 5.8, y: y + 0.1, w: 3.6, h: 0.44,
            fontSize: 12, color: C.dark, valign: 'middle'
        });
    });

    addFooter(s, 6);
}

function slide07_FAQ(pptx) {
    var s = pptx.addSlide();
    addHeader(s, pptx, '자주 묻는 질문', 'FAQ');

    var faqs = [
        { q: '파일 첨부는 어떻게 하나요?', a: '제출 폼에서 파일을 드래그하거나 클릭해 업로드합니다. 여러 파일 동시 선택 가능.' },
        { q: '산출물을 삭제할 수 있나요?', a: '작성자 본인과 관리자만 삭제 가능합니다.' },
        { q: '공개 범위는 언제든지 바꿀 수 있나요?', a: '예, 작성자는 언제든지 공개 ↔ 비공개를 전환할 수 있습니다.' },
        { q: '역할 변경은 어떻게 하나요?', a: '/admin/users에서 관리자가 guest·member 역할을 부여합니다.' },
    ];

    faqs.forEach(function(faq, i) {
        var y = 1.2 + i * 0.98;

        s.addShape(pptx.ShapeType.roundRect, {
            x: 0.4, y: y, w: 0.55, h: 0.38,
            fill: { color: C.rose },
            line: { color: C.rose },
            rectRadius: 0.06
        });
        s.addText('Q', {
            x: 0.4, y: y, w: 0.55, h: 0.38,
            fontSize: 16, bold: true, color: C.white, align: 'center', valign: 'middle'
        });
        s.addText(faq.q, {
            x: 1.1, y: y + 0.02, w: 8.5, h: 0.38,
            fontSize: 13, bold: true, color: C.dark
        });

        s.addShape(pptx.ShapeType.roundRect, {
            x: 0.4, y: y + 0.46, w: 0.55, h: 0.35,
            fill: { color: C.mauve },
            line: { color: C.mauve },
            rectRadius: 0.06
        });
        s.addText('A', {
            x: 0.4, y: y + 0.46, w: 0.55, h: 0.35,
            fontSize: 14, bold: true, color: C.white, align: 'center', valign: 'middle'
        });
        s.addText(faq.a, {
            x: 1.1, y: y + 0.46, w: 8.5, h: 0.36,
            fontSize: 12, color: C.mauve
        });
    });

    addFooter(s, 7);
}

function slide08_Close(pptx) {
    var s = pptx.addSlide();
    s.background = { color: C.blush };

    s.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: 0.12,
        fill: { color: C.rose },
        line: { color: C.rose }
    });

    s.addText('WBSCowork', {
        x: 0, y: 1.5, w: '100%', h: 1.1,
        fontSize: 52, bold: true, color: C.dark,
        fontFace: 'Georgia', align: 'center'
    });
    s.addText('태스크 기반 산출물 협업을 시작하세요', {
        x: 0, y: 2.8, w: '100%', h: 0.6,
        fontSize: 18, color: C.accent, align: 'center', italic: true
    });

    s.addShape(pptx.ShapeType.line, {
        x: 3.5, y: 3.65, w: 3.0, h: 0,
        line: { color: C.rose, width: 2 }
    });

    s.addText('Next.js 16 \u00b7 TypeScript \u00b7 MUI \u00b7 MariaDB \u00b7 frappe-gantt', {
        x: 0, y: 3.9, w: '100%', h: 0.4,
        fontSize: 12, color: C.mauve, align: 'center'
    });

    addFooter(s, 8);
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────

async function createPresentation() {
    console.log('\uD83C\uDF38 WBSCowork 발표자료 생성 중 (Warm Blush 테마)...\n');

    var pptx = new pptxgen();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'WBSCowork Team';
    pptx.title = 'WBSCowork 사용설명서';
    pptx.subject = '태스크 기반 산출물 협업 시스템';

    slide01_Title(pptx);
    slide02_GanttDemo(pptx);
    slide03_Roles(pptx);
    slide04_Visibility(pptx);
    slide05_Workflow(pptx);
    slide06_Admin(pptx);
    slide07_FAQ(pptx);
    slide08_Close(pptx);

    var outputDir = path.join(__dirname, 'outputs');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    var outputFile = path.join(outputDir, 'WBSCowork_Manual.pptx');
    await pptx.writeFile({ fileName: outputFile });

    console.log('\u2705 완료!\n');
    console.log('\uD83D\uDCC4 파일: ' + outputFile);
    console.log('\uD83D\uDCCA 슬라이드: 8개');
    console.log('\uD83C\uDFA8 테마: Warm Blush (Mauve · Blush · Rose · Cream)');
    console.log('\uD83D\uDCF8 스크린샷: ' + (fs.existsSync(SCREENSHOT) ? '포함' : '미포함 (파일 없음)'));
}

createPresentation().catch(function(err) {
    console.error('오류:', err);
    process.exit(1);
});
