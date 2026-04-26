#!/usr/bin/env node

/**
 * WBSCowork 사용설명서 HTML → PowerPoint 변환 스크립트
 * 
 * 사용법:
 *   node convert-manual-to-pptx.js
 * 
 * 필수 설치:
 *   npm install -g pptxgenjs playwright sharp
 */

const pptxgen = require('pptxgenjs');
const fs = require('fs');
const path = require('path');

// 색상 팔레트 (Teal & Coral)
const COLORS = {
    tealDark: '277884',
    teal: '5EA8A7',
    coral: 'FE4447',
    white: 'FFFFFF',
    lightGray: 'f5f5f5',
    darkText: '333333',
    mediumText: '666666',
    lightText: '999999'
};

async function createPresentation() {
    console.log('🚀 WBSCowork 사용설명서 변환 시작...\n');

    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'WBSCowork Team';
    pptx.title = 'WBSCowork 사용설명서';
    pptx.subject = '태스크 기반 산출물 협업 시스템 사용 가이드';

    // 슬라이드 1: 제목
    addTitleSlide(pptx, 'WBSCowork', '태스크 기반 산출물 협업 시스템\n\n사용설명서');

    // 슬라이드 2: 핵심 개념
    addContentSlide(pptx, '핵심 개념', '태스크 기반 산출물 협업 시스템의 특징', [
        { text: '세 가지 핵심 기능:', bold: true },
        { text: '', level: 0 },
        { text: 'WBS/간트 기반 업무 관리 — 주간 업무를 시각적으로 계획하고 추적', level: 1 },
        { text: 'ID태스크 단위 산출물 제출 — 각 태스크에 결과물을 체계적으로 등록', level: 1 },
        { text: '팀원 간 피드백 & 협업 — 댓글을 통한 실시간 협업 및 피드백', level: 1 }
    ]);

    // 슬라이드 3: 기술 스택
    addContentSlide(pptx, '기술 스택', 'WBSCowork를 구성하는 기술들', [
        { text: '프론트엔드: Next.js 16, TypeScript, React, MUI', bold: true },
        { text: '', level: 0 },
        { text: '백엔드 & 데이터: Node.js, MariaDB, NextAuth v4, TanStack Query', bold: true },
        { text: '', level: 0 },
        { text: '차트 & 시각화: frappe-gantt, Google OAuth', bold: true }
    ]);

    // 슬라이드 4: 역할 시스템
    addRoleSlide(pptx);

    // 슬라이드 5: 제출물 공개 범위
    addContentSlide(pptx, '제출물 공개 범위', 'Visibility 설정으로 접근 제어', [
        { text: '공개 (public): 모든 인증 사용자가 조회 가능', bold: true },
        { text: '', level: 0 },
        { text: '비공개 (private): 제한된 사용자만 조회 가능', bold: true },
        { text: '작성자 (본인)', level: 2 },
        { text: '관리자 (admin 역할)', level: 2 },
        { text: '슈퍼관리자 (isSuperuser)', level: 2 }
    ]);

    // 슬라이드 6: 메인 화면
    addContentSlide(pptx, '메인 화면', '홈 (/) 의 구성', [
        { text: '상단: 프로젝트 선택 — 현재 진행 중인 프로젝트를 선택', bold: true },
        { text: '', level: 0 },
        { text: '중앙: Gantt 타임라인 — 선택한 프로젝트의 모든 태스크를 간트 차트로 시각화', bold: true },
        { text: '', level: 0 },
        { text: '하단: 태스크 목록 — 현재 프로젝트의 모든 태스크를 리스트로 표시', bold: true }
    ]);

    // 슬라이드 7: 태스크 관리
    addContentSlide(pptx, '태스크 관리', '태스크 생성 및 편집', [
        { text: '새 태스크 생성', bold: true },
        { text: '홈 화면의 \"새 태스크\" 버튼 클릭', level: 1 },
        { text: '태스크 제목, 설명, 날짜 입력', level: 1 },
        { text: '상위 태스크 지정 (선택)', level: 1 },
        { text: '저장', level: 1 },
        { text: '', level: 0 },
        { text: '태스크 수정: Gantt 차트에서 클릭 또는 리스트에서 선택 후 편집', bold: true }
    ]);

    // 슬라이드 8: 산출물 제출
    addContentSlide(pptx, '산출물 제출', '태스크에 결과물 등록하기', [
        { text: '제출 절차', bold: true },
        { text: '태스크를 열고 \"산출물 추가\" 클릭', level: 1 },
        { text: '제목, 내용, 공개 범위 설정', level: 1 },
        { text: '파일 첨부 (선택)', level: 1 },
        { text: '제출', level: 1 },
        { text: '', level: 0 },
        { text: '공개/비공개를 구분하여 정보 관리', bold: true, color: COLORS.coral }
    ]);

    // 슬라이드 9: 댓글 협업
    addContentSlide(pptx, '댓글 및 협업', '팀원과 실시간으로 소통하기', [
        { text: '댓글 달기: 산출물 또는 태스크 하단의 댓글 섹션에 입력', bold: true },
        { text: '', level: 0 },
        { text: '협업의 장점', bold: true },
        { text: '실시간 피드백 — 팀원들이 즉시 반응', level: 1 },
        { text: '컨텍스트 보존 — 태스크/산출물과 함께 논의 기록', level: 1 },
        { text: '역할별 접근 — 공개/비공개 댓글 구분', level: 1 }
    ]);

    // 슬라이드 10: 관리자 패널
    addContentSlide(pptx, '관리자 패널', '/admin 대시보드 안내', [
        { text: '슈퍼관리자: 모든 관리 기능 접근', bold: true },
        { text: '관리자: /admin, /admin/users만 접근', bold: true },
        { text: '', level: 0 },
        { text: '주요 기능 (슈퍼관리자 전용)', bold: true },
        { text: '/admin/database: DB 테이블 생성 및 초기화', level: 1 },
        { text: '/admin/logs: 시스템 로그 조회 및 분석', level: 1 },
        { text: '/admin/settings: 환경변수 편집', level: 1 }
    ]);

    // 슬라이드 11: 사용 팁
    addContentSlide(pptx, '사용 팁', '효율적인 사용을 위한 조언', [
        { text: '태스크 작성 팁', bold: true },
        { text: '명확한 제목과 설명으로 의도를 분명히 하기', level: 1 },
        { text: '적절한 시간 범위 설정 (너무 길거나 짧지 않게)', level: 1 },
        { text: '협업 모범 사례', bold: true },
        { text: '산출물에는 명확한 제목과 설명 작성', level: 1 },
        { text: '파일 첨부 시 버전 명시 (예: v1.0, Draft_2 등)', level: 1 },
        { text: '댓글은 건설적이고 구체적으로 작성', level: 1 }
    ]);

    // 슬라이드 12: 권한 관리
    addContentSlide(pptx, '권한 관리', '사용자 역할 및 접근 제어', [
        { text: '권한 변경 절차 (/admin/users)', bold: true },
        { text: '사용자 선택', level: 1 },
        { text: '새 역할 선택 (guest/member/admin)', level: 1 },
        { text: '저장', level: 1 },
        { text: '', level: 0 },
        { text: '역할 업그레이드 규칙', bold: true },
        { text: '관리자: guest/member만 부여 (슈퍼관리자만 admin 부여)', level: 1 },
        { text: '슈퍼관리자: 환경변수에 지정된 이메일만 해당', level: 1 }
    ]);

    // 슬라이드 13: FAQ
    addContentSlide(pptx, '자주 묻는 질문', 'FAQ', [
        { text: 'Q. 산출물을 어떻게 삭제하나요?', bold: true },
        { text: '산출물 작성자와 관리자만 삭제 가능합니다.', level: 1 },
        { text: '', level: 0 },
        { text: 'Q. 공개 산출물을 비공개로 변경할 수 있나요?', bold: true },
        { text: '네, 작성자는 언제든지 변경할 수 있습니다.', level: 1 },
        { text: '', level: 0 },
        { text: 'Q. 태스크 순서를 변경할 수 있나요?', bold: true },
        { text: '네, Gantt 차트에서 드래그하여 조정할 수 있습니다.', level: 1 }
    ]);

    // 슬라이드 14: 핵심 요약
    addSummarySlide(pptx);

    // 슬라이드 15: 마무리
    addClosingSlide(pptx);

    // 저장
    const outputDir = path.join(__dirname, 'outputs');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const outputFile = path.join(outputDir, 'WBSCowork_Manual.pptx');
    await pptx.writeFile({ fileName: outputFile });

    console.log(`\n✅ 변환 완료!\n`);
    console.log(`📄 파일: ${outputFile}`);
    console.log(`📊 슬라이드: 15개`);
    console.log(`🎨 테마: Teal & Coral`);
}

function addTitleSlide(pptx, mainTitle, subtitle) {
    const slide = pptx.addSlide();

    // 헤더 배경
    slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: 2.5,
        fill: { color: COLORS.tealDark }
    });

    // 상단 제목
    slide.addText(mainTitle, {
        x: 0.5, y: 0.5, w: 9, h: 1,
        fontSize: 52, bold: true, color: COLORS.white,
        align: 'center'
    });

    // 부제목
    slide.addText(subtitle, {
        x: 0.5, y: 2.8, w: 9, h: 1.2,
        fontSize: 24, color: COLORS.coral,
        align: 'center'
    });

    // 하단 텍스트
    slide.addText('Next.js + TypeScript 기반 WBS/간트 협업 플랫폼', {
        x: 0.5, y: 3.5, w: 9, h: 0.5,
        fontSize: 16, color: COLORS.lightText,
        align: 'center'
    });
}

function addContentSlide(pptx, title, subtitle, bulletPoints) {
    const slide = pptx.addSlide();

    // 헤더
    slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: 1.2,
        fill: { color: COLORS.tealDark }
    });

    // 제목
    slide.addText(title, {
        x: 0.5, y: 0.2, w: 9, h: 0.6,
        fontSize: 40, bold: true, color: COLORS.white
    });

    // 부제목
    slide.addText(subtitle, {
        x: 0.5, y: 0.8, w: 9, h: 0.3,
        fontSize: 14, color: 'EEEEEE'
    });

    // 콘텐츠
    const contentY = 1.5;
    slide.addText(bulletPoints, {
        x: 0.8, y: contentY, w: 8.4, h: 3.2,
        fontSize: 16, color: COLORS.darkText,
        valign: 'top'
    });
}

function addRoleSlide(pptx) {
    const slide = pptx.addSlide();

    // 헤더
    slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: 1.2,
        fill: { color: COLORS.tealDark }
    });

    slide.addText('역할 시스템', {
        x: 0.5, y: 0.2, w: 9, h: 0.6,
        fontSize: 40, bold: true, color: COLORS.white
    });

    slide.addText('네 가지 사용자 역할', {
        x: 0.5, y: 0.8, w: 9, h: 0.3,
        fontSize: 14, color: 'EEEEEE'
    });

    // 역할 박스들
    const roles = [
        { name: '슈퍼관리자', desc: '모든 권한: DB 관리, 환경설정, 사용자 관리' },
        { name: '관리자', desc: '관리 권한: /admin, /admin/users, 모든 제출물' },
        { name: '일반사용자', desc: '편집 권한: 태스크/제출물 CRUD' },
        { name: '게스트', desc: '읽기 권한: 공개 제출물만 조회' }
    ];

    roles.forEach((role, idx) => {
        const y = 1.5 + (idx * 0.8);
        const bgColor = idx % 2 === 0 ? 'F5F5F5' : 'FFFFFF';

        slide.addShape(pptx.ShapeType.rect, {
            x: 0.5, y: y, w: 9, h: 0.75,
            fill: { color: bgColor },
            line: { color: COLORS.teal, width: 1 }
        });

        slide.addText(role.name, {
            x: 0.7, y: y + 0.05, w: 2, h: 0.3,
            fontSize: 14, bold: true, color: COLORS.tealDark
        });

        slide.addText(role.desc, {
            x: 3, y: y + 0.05, w: 6, h: 0.65,
            fontSize: 13, color: COLORS.mediumText,
            valign: 'middle'
        });
    });
}

function addSummarySlide(pptx) {
    const slide = pptx.addSlide();

    // 헤더
    slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: 1.2,
        fill: { color: COLORS.tealDark }
    });

    slide.addText('핵심 요약', {
        x: 0.5, y: 0.2, w: 9, h: 0.6,
        fontSize: 40, bold: true, color: COLORS.white
    });

    // 4가지 단계
    const steps = [
        '1️⃣ 프로젝트 선택',
        '2️⃣ 태스크 확인',
        '3️⃣ 산출물 제출',
        '4️⃣ 협업 & 피드백'
    ];

    let y = 1.8;
    steps.forEach(step => {
        slide.addText(step, {
            x: 1, y: y, w: 8, h: 0.5,
            fontSize: 18, bold: true, color: COLORS.teal
        });
        y += 0.65;
    });
}

function addClosingSlide(pptx) {
    const slide = pptx.addSlide();

    // 그래디언트 배경
    slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: '100%',
        fill: { color: COLORS.tealDark }
    });

    // 제목
    slide.addText('감사합니다!', {
        x: 0.5, y: 1.5, w: 9, h: 0.8,
        fontSize: 48, bold: true, color: COLORS.coral,
        align: 'center'
    });

    // 부제목
    slide.addText('WBSCowork 사용설명서', {
        x: 0.5, y: 2.4, w: 9, h: 0.5,
        fontSize: 20, color: COLORS.white,
        align: 'center'
    });

    // 메시지
    slide.addText('더 나은 팀 협업을 위해', {
        x: 0.5, y: 3.2, w: 9, h: 0.4,
        fontSize: 16, color: 'CCCCCC',
        align: 'center'
    });
}

// 실행
createPresentation().catch(err => {
    console.error('❌ 변환 오류:', err.message);
    process.exit(1);
});
