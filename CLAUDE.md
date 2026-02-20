# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

뼈갈단 V3 (Bonesquad V3) — 한국어 스터디/생산성 추적 웹앱. GitHub Pages로 배포되는 단일 페이지 애플리케이션.

## Architecture

**단일 파일 구조**: 모든 HTML, CSS, JS가 `index.html` 하나에 포함됨. 이미지는 `images/` 폴더.

- **프론트엔드**: Vanilla HTML/CSS/JS (프레임워크 없음)
- **백엔드**: Google Apps Script (`SCRIPT_URL` 상수로 연결)
- **아바타**: DiceBear API (`https://api.dicebear.com/7.x/{style}/svg`)
- **클라이언트 저장소**: LocalStorage (사용자 이름 저장)

## Data Flow

`dbData` 전역 객체가 모든 데이터를 보유:
- `tasks`, `feeds`, `comments`, `members`, `groupMembers`, `groupPosts`, `dietLogs`, `groups`, `deletedDefaultGroups`

데이터 변경 시 패턴: **프론트 즉시 업데이트 → 비동기 POST로 서버 저장** (optimistic update)

## Key Tabs & Functions

| 탭 | 주요 렌더 함수 | 모달 |
|---|---|---|
| 오늘의 성과 | `renderWeeklyCalendar()` | `taskModal`(작성 전용), `dayDetailModal`(모두의 성과 보기), `weeklyCalendarModal` |
| 뼈이스북 | `renderFeed()` | — |
| 그룹 | `renderGroupList()`, `enterGroup()` | `createGroupModal`, `dietModal` |
| 멤버 소개 | `renderMembers()` | — |

## Key Helpers

- `parseDateKey(dk)`: `"2025-2-15"` 형식 dateKey → Date 객체 변환
- `isBeforeFirstTask(name, dateKey)`: 멤버의 첫 성과 이전 날짜인지 판별 (미작성 카드 숨김용)
- `getFirstTaskDate(name)`: 멤버의 첫 성과 날짜 반환 (가입일 표시용)
- `parseTaskContent(taskStr)`: 성과 JSON 문자열 → `{rating, items}` 파싱
- `getAllGroups()`: 기본 그룹 + 사용자 생성 그룹 합침

## Development & Deployment

- **빌드 불필요**: 정적 HTML 파일, 빌드/번들 과정 없음
- **배포**: `git push origin main` → GitHub Pages 자동 배포
- **테스트**: 자동화 테스트 없음, 배포 후 브라우저에서 수동 확인

## Conventions

- 커밋 메시지는 한국어로 작성
- 수정 완료 후 자동으로 git commit & push 수행 (사용자에게 확인 불필요)
- 그룹 시스템: `DEFAULT_GROUPS` 배열(기본 그룹)과 `dbData.groups`(사용자 생성 그룹)를 `getAllGroups()`로 합침
- 다이어트 그룹(`'뼈만 남는 다이어트'`)만 식단 로그 UI, 나머지 모든 그룹은 게시판 UI 사용
- 성과 탭: 카드 클릭 → `openDayDetail()` (보기), "성과 작성" 버튼 → `openModal()` (작성 전용)
