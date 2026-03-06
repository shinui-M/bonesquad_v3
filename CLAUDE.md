# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

뼈갈단 V3 (Bonesquad V3) — 한국어 스터디/생산성 추적 웹앱. GitHub Pages로 배포되는 단일 페이지 애플리케이션.

## Architecture

**단일 파일 구조**: 모든 HTML, CSS, JS가 `index.html` (~1100행) 하나에 포함됨. 이미지는 `images/` 폴더.

- **프론트엔드**: Vanilla HTML/CSS/JS (프레임워크 없음)
- **백엔드**: Google Apps Script — `SCRIPT_URL` 상수(index.html 7행)로 연결. 서버 코드는 별도 Google Apps Script 프로젝트에 있음 (이 저장소에 없음)
- **아바타**: DiceBear API (`https://api.dicebear.com/7.x/{style}/svg`)
- **클라이언트 저장소**: LocalStorage

### index.html 내부 구조 (행 기준 대략적 위치)
- **7행**: `SCRIPT_URL` 상수 (Google Apps Script 배포 URL)
- **16~201행**: `<style>` — 모든 CSS (반응형 포함)
- **203~460행**: `<body>` — HTML 마크업 (탭, 모달, 폼 등)
- **461행~끝**: `<script>` — 모든 JS (전역 상태, loadData, 렌더 함수, 이벤트 핸들러)

### JS 코드 섹션 구분 (주석 구분자 기준)
- ~541행: 오늘의 성과 (프로필 카드 그리드)
- ~699행: 주간 달력 모달
- ~780행: 그룹 기능

## Data Flow

### 전역 상태
- `dbData` — 서버에서 가져온 모든 데이터: `tasks`, `feeds`, `comments`, `members`, `groupMembers`, `groupPosts`, `dietLogs`, `groups`, `deletedDefaultGroups`
- `currentDate` — 성과 탭 표시 기준 날짜
- `currentGroup` — 현재 진입한 그룹 이름 (null이면 목록 화면)
- `selectedDateKey` — 성과 작성 모달에서 선택된 날짜

### 서버 통신 패턴
- **읽기**: `loadData()` → `GET SCRIPT_URL?action=getAllData` → `dbData = data`
- **쓰기**: Optimistic update (프론트 즉시 반영) → `fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: '...', ...data }) })` fire-and-forget
- POST action 종류: `saveTask`, `saveFeed`, `saveMember`, `saveComment`, `deleteFeed`, `editFeed`, `createGroup`, `deleteGroup`, `joinGroup`, `leaveGroup`, `saveGroupPost`, `editGroupPost`, `deleteGroupPost`, `saveDietLog`

### 서버 (Google Apps Script) 구조
- **`doGet(e)`**: 모든 시트 데이터를 JSON으로 반환
- **`doPost(e)`**: `action` 필드로 분기하여 해당 시트에 행 추가/수정/삭제
- **`updateOrAppendRow(sheet, criteria, newRowData, updateColIndex)`**: criteria 매칭 시 `updateColIndex`부터 끝까지 모든 컬럼 업데이트, 미매칭 시 appendRow
- 시트 목록: Tasks, Feeds, Comments, Members, GroupMembers, GroupPosts, DietLogs
- **SCRIPT_URL 변경 시**: 서버 코드 수정 후 새 배포하면 URL이 바뀜 → index.html 7행 SCRIPT_URL도 함께 업데이트 필요

### loadData() 흐름 (순서 중요)
1. 서버 데이터 수신 → `dbData = data`
2. `groups`, `deletedDefaultGroups`, `members` 초기화
3. 멤버 중복 제거 (같은 이름이면 마지막 항목 유지)
4. localStorage 프로필로 내 멤버 데이터 덮어쓰기
5. 렌더링 (`renderWeeklyCalendar`, `renderFeed`, `renderMembers`, `renderGroupList`)
6. 폼 필드 복원 (아바타 스타일/시드, bio)

### localStorage 키
- `study_username` — 사용자 이름 (자동 저장/복원)
- `study_profile_{name}` — 프로필 백업 (bio, avatar, createdAt)

### dateKey 형식
`"YYYY-M-D"` (zero-padding 없음, 예: `"2025-2-5"`). `parseDateKey(dk)` 함수로 Date 변환.

## Key Tabs & Functions

| 탭 | 주요 렌더 함수 | 모달 |
|---|---|---|
| 오늘의 성과 | `renderWeeklyCalendar()` | `taskModal`(작성), `dayDetailModal`(보기), `weeklyCalendarModal` |
| 뼈이스북 | `renderFeed()` | — |
| 그룹 | `renderGroupList()`, `enterGroup()` | `createGroupModal`, `dietModal` |
| 멤버 소개 | `renderMembers()` | — |

### 성과 탭 흐름
- 카드 클릭 → `openDayDetail(date)` (모두의 성과 보기)
- "성과 작성" 버튼 → `openModal(date)` (내 성과 작성/편집)
- 성과 데이터: `{ rating: "3.5", items: [{ category: "몰입", content: "..." }] }` JSON 문자열로 저장
- 별점: `renderStars(rating)` — CSS 오버레이로 소수점 단위 시각 표현

### 그룹 시스템
- `DEFAULT_GROUPS` 배열(기본 그룹) + `dbData.groups`(사용자 생성 그룹) → `getAllGroups()`로 합침
- `'뼈만 남는 다이어트'` 그룹만 식단 로그 UI(`renderDietLogs`), 나머지 모든 그룹은 게시판 UI(`renderGroupPosts`)

## Key Helpers

- `parseDateKey(dk)`: dateKey → Date 객체
- `isBeforeFirstTask(name, dateKey)`: 멤버의 첫 성과 이전 날짜인지 판별 (미작성 카드 숨김용)
- `getFirstTaskDate(name)`: 멤버의 첫 성과 날짜 반환 (가입일 표시용)
- `parseTaskContent(taskStr)`: 성과 JSON 문자열 → `{rating, items}` 파싱
- `renderStars(rating)`: 별점 수치를 CSS 오버레이 방식으로 시각화
- `getAllGroups()`: 기본 그룹 + 사용자 생성 그룹 합침

## Development & Deployment

- **빌드 불필요**: 정적 HTML 파일, 빌드/번들 과정 없음
- **배포**: `git push origin main` → GitHub Pages 자동 배포
- **테스트**: 자동화 테스트 없음, 배포 후 브라우저에서 수동 확인

## Conventions

- 커밋 메시지는 한국어로 작성
- 수정 완료 후 자동으로 git commit & push 수행 (사용자에게 확인 불필요)
