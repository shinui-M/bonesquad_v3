# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

뼈갈단 V3 (Bonesquad V3) — 한국어 스터디/생산성 추적 웹앱. GitHub Pages로 배포되는 단일 페이지 애플리케이션.

## Architecture

**단일 파일 구조**: 모든 HTML, CSS, JS가 `index.html` 하나에 포함됨. 이미지는 `images/` 폴더.

- **프론트엔드**: Vanilla HTML/CSS/JS (프레임워크 없음)
- **백엔드**: Google Apps Script — `SCRIPT_URL` 상수(index.html 7행)로 연결. 서버 코드는 별도 Google Apps Script 프로젝트에 있음 (이 저장소에 없음)
- **아바타**: DiceBear API (`https://api.dicebear.com/7.x/{style}/svg`)
- **클라이언트 저장소**: LocalStorage

### index.html 내부 구조

행 번호는 수정에 따라 변동되므로 대략적 위치로 참고.

- `SCRIPT_URL` 상수 — 파일 최상단 (7행)
- `<style>` — 모든 CSS (반응형 포함)
- `<body>` — HTML 마크업 (탭 4개, 모달 5개, 폼)
- `<script>` — 모든 JS

### JS 주요 섹션
- 전역 상태 & `loadData()`
- 오늘의 성과 (`renderWeeklyCalendar`, `openDayDetail`)
- 주간 달력 모달 (`renderWeekGridModal`)
- 그룹 기능 (`renderGroupList`, `enterGroup`)
  - 그룹 게시판 (`renderGroupPosts`)
  - 오픽 스터디 스케줄 선택기 (`renderScheduleGrid`)
  - 다이어트 로그 (`renderDietLogs`)
- 피드 / 뼈이스북 (`renderFeed`)
- 멤버 소개 (`renderMembers`, `saveMember`)
- 뼈갈지수 & 성과 반응 (`toggleFire`, `saveBoneScore`, `openCommentModal` 등)

## Data Flow

### 전역 상태
- `dbData` — 서버에서 가져온 모든 데이터: `tasks`, `feeds`, `comments`, `members`, `groupMembers`, `groupPosts`, `dietLogs`, `groups`, `deletedDefaultGroups`, `taskReactions`, `taskComments`
- `currentDate` — 성과 탭 표시 기준 날짜
- `currentDetailDate` — 현재 열린 `dayDetailModal`의 날짜 (`loadData` 완료 시 자동 재렌더용)
- `currentGroup` — 현재 진입한 그룹 이름 (null이면 목록 화면)
- `currentCommentTaskId` — 댓글 모달에서 현재 보고 있는 taskId
- `selectedDateKey` — 성과 작성 모달에서 선택된 날짜
- `scheduleWeekDate` — 오픽 스터디 스케줄 선택기의 현재 주 기준 날짜
- `window._dcTaskIds` — `openDayDetail` 호출 시마다 초기화되는 taskId 배열. `onclick` 인라인 핸들러에서 `window._dcTaskIds[idx]`로 참조

### 서버 통신 패턴
- **읽기**: `loadData()` → `GET SCRIPT_URL?action=getAllData` → `dbData = data`
  - `response.text()` → `JSON.parse()` 순서로 파싱. 실패 시 기존 `dbData`로 렌더링 fallback
  - `loadData` 완료 후 `dayDetailModal`이 열려 있으면 `openDayDetail(currentDetailDate)` 자동 재호출 (서버 동기화)
- **쓰기**: Optimistic update (프론트 즉시 반영) → `fetch(SCRIPT_URL, { method: 'POST', ... })` fire-and-forget
- POST action 종류: `saveTask`, `saveFeed`, `editFeed`, `deleteFeed`, `saveComment`, `saveMember`, `joinGroup`, `leaveGroup`, `saveGroupPost`, `editGroupPost`, `deleteGroupPost`, `saveDietLog`, `saveTaskReaction`, `saveTaskComment`, `editTaskComment`, `deleteTaskComment`

### 서버 (Google Apps Script) 구조
- **`doGet(e)`**: 컬럼 인덱스 기반 고정 매핑으로 JSON 반환 (헤더명 무관). try-catch로 에러 시에도 빈 배열 JSON 반환
- **`doPost(e)`**: `action` 필드로 분기
- **`upsert(sheet, criteria, newRow, updateFromCol)`**: `criteria`는 `[[colIdx(0-based), value], ...]` 배열. 매칭 행 있으면 `updateFromCol`부터 덮어쓰기, 없으면 appendRow
- **`deleteRowsByCol(sheet, colIdx, value)`** / **`deleteRowsByTwoCols(...)`**: 조건 행 삭제
- 시트 목록: Tasks, Feeds, Comments, Members, GroupMembers, GroupPosts, DietLogs, **TaskReactions**, **TaskComments**
- **SCRIPT_URL 변경 시**: 재배포 후 새 URL → index.html 7행 `SCRIPT_URL` 업데이트 필요

### 시트 컬럼 순서 (0-based index)
| 시트 | 컬럼 |
|---|---|
| Tasks | date, name, task |
| Feeds | id, name, content, timestamp |
| Comments | feedId, name, content, timestamp |
| Members | name, bio, avatar, createdAt, bannerColor |
| GroupMembers | groupName, name, avatar |
| GroupPosts | id, groupName, name, content, timestamp |
| DietLogs | date, groupName, name, content |
| TaskReactions | taskId, raterName, boneScore, fire, timestamp |
| TaskComments | id, taskId, name, content, timestamp |

### loadData() 흐름 (순서 중요)
1. `response.text()` → `JSON.parse()` (파싱 실패 시 catch로 fallback 렌더링)
2. `dbData = data` + null 필드 초기화
3. 멤버 중복 제거 (같은 이름이면 마지막 항목 유지)
4. localStorage 프로필로 내 멤버 데이터 덮어쓰기
5. 렌더링 (`renderWeeklyCalendar`, `renderFeed`, `renderMembers`, `renderGroupList`)
6. `dayDetailModal` 열려 있으면 `openDayDetail(currentDetailDate)` 재호출
7. 폼 필드 복원 (아바타 스타일/시드, bio)

### localStorage 키
- `study_username` — 사용자 이름 (자동 저장/복원)
- `study_profile_{name}` — 프로필 백업 (bio, avatar, createdAt, bannerColor)

### dateKey 형식
`"YYYY-M-D"` (zero-padding 없음, 예: `"2025-2-5"`). `parseDateKey(dk)` 함수로 Date 변환.

### taskId 형식
`"${dateKey}_${memberName}"` (예: `"2025-2-5_철수"`). 뼈갈지수/반응/댓글의 기본 키.

## Key Tabs & Functions

| 탭 | 주요 렌더 함수 | 모달 |
|---|---|---|
| 오늘의 성과 | `renderWeeklyCalendar()` | `taskModal`(작성), `dayDetailModal`(보기), `weeklyCalendarModal` |
| 뼈이스북 | `renderFeed()` | — |
| 그룹 | `renderGroupList()`, `enterGroup()` | `dietModal` |
| 멤버 소개 | `renderMembers()` | — |
| (공통) | — | `commentModal` (성과 댓글) |

### 성과 탭 흐름
- 카드 클릭 → `openDayDetail(date)` (모두의 성과 보기)
- "성과 작성" 버튼 → `openModal(date)` (내 성과 작성/편집)
- 성과 데이터: `{ rating: "3.5", items: [{ category: "몰입", content: "..." }] }` JSON 문자열로 저장
- 카테고리: 몰입, 성장, 일정, 충전, 기타

### 뼈갈지수 & 성과 반응 시스템

`dayDetailModal`의 각 성과 카드에 표시. `taskId = "${date}_${memberName}"`.

- **뼈갈지수 슬라이더 (0~10)**: `onchange`(손 뗄 때)만 저장 → `saveBoneScore(taskId, score)` → `persistReaction()`
- **🔥 불 이모지**: 토글 → `toggleFire(taskId)` → `persistReaction()`
- **💬 댓글 버튼**: 댓글 수 표시. 클릭 → `openCommentModal(taskId, taskOwner)` → `commentModal` 열림
- `persistReaction()`: `dbData.taskReactions`에 raterName+taskId 기준 upsert 후 서버 POST
- `taskSafeId(taskId)`: taskId를 해시값으로 변환해 DOM ID로 사용 (`bone-avg-${sid}`, `fire-btn-${sid}` 등)
- `window._dcTaskIds[idx]`: 인라인 onclick에서 taskId 전달용 레지스트리 (openDayDetail 호출마다 초기화)

### 뼈갈지수 순위 시각화

`renderWeeklyCalendar()`와 `openDayDetail()` 양쪽에서 동일한 로직으로 계산:
- 해당 날짜 제출자 중 뼈갈지수 평가받은 사람을 평균 기준 정렬
- 1위 🥇 금색 테두리, 2위 🥈 은색, 3위 🥉 동색 테두리
- **꼴등 💀 점선 테두리**: 평가받은 인원 4명 이상일 때만 표시
- CSS 클래스: `rank-gold`, `rank-silver`, `rank-bronze`, `rank-last` (카드 + 아바타 이미지에 적용)

### 그룹 시스템
- `DEFAULT_GROUPS` 배열(기본 그룹 2개: 오픽 스터디, 뼈만 남는 다이어트) → `getAllGroups()`로 합침
- `enterGroup()`에서 그룹 이름에 따라 3가지 UI 분기:
  1. `'뼈만 남는 다이어트'` → `renderDietLogs()`
  2. `'오픽 스터디'` → `renderScheduleGrid()`
  3. 나머지 → `renderGroupPosts()`

### 오픽 스터디 스케줄 선택기
- 주간 시간표 그리드 (월~일, 9:00~21:00, 1시간 단위), 히트맵 방식
- `groupPosts` 테이블에 JSON으로 저장: `{ type: "schedule", weekStart: "2026-3-2", slots: { "2026-3-2": ["09:00", "14:00"] } }`
- 사용자당 주차당 1개 포스트 (upsert 방식)

## Key Helpers

- `parseDateKey(dk)`: dateKey → Date 객체
- `isBeforeFirstTask(name, dateKey)`: 멤버의 첫 성과 이전 날짜 여부 (미작성 카드 숨김용)
- `getFirstTaskDate(name)`: 멤버의 첫 성과 날짜 반환
- `parseTaskContent(taskStr)`: 성과 JSON 문자열 → `{rating, items}` 파싱
- `renderStars(rating)`: 별점 수치를 CSS 오버레이로 시각화
- `taskSafeId(taskId)`: taskId 해시 → 충돌 없는 DOM ID 문자열
- `getAvgBoneScore(taskId)`: 해당 task의 뼈갈지수 평균 (평가 없으면 null)
- `getFireCount(taskId)`: 불 이모지 수
- `getMyReactionFor(taskId)`: 현재 사용자의 reaction 객체
- `getMemberColor(member)`: 배너 색상 → HSL 그라디언트 2색 반환
- `getScheduleWeekStart(date)`: Date → 해당 주 월요일 dateKey
- `getScheduleWeekDates(weekStartKey)`: weekStart → 7일치 dateKey 배열

## Development & Deployment

- **빌드 불필요**: 정적 HTML 파일
- **로컬 테스트**: `python -m http.server 8080` → `http://localhost:8080` (또는 `serve.bat`)
  - CORS 때문에 반드시 HTTP 서버로 실행 (파일 직접 열기 불가)
- **배포**: `git push origin main` → GitHub Pages 자동 배포 (1~2분)
- **테스트**: 자동화 테스트 없음, 브라우저에서 수동 확인
- **test.html**: 실험적 변경 작업용. 프로덕션 반영 전 여기서 먼저 확인

## Conventions

- 커밋 메시지는 한국어로 작성
- 수정 완료 후 자동으로 git commit & push 수행 (사용자에게 확인 불필요)
- 변경 전 `test.html`에서 먼저 테스트하고, 확인 후 `index.html`에 반영
- 새 POST action 추가 시 Apps Script도 함께 업데이트 필요 → 재배포 → SCRIPT_URL 갱신
