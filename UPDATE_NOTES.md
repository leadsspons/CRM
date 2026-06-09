# CRM 업데이트 노트 (2026-06)

## 1. 언어 토글 (🇰🇷 한국어 / 🇬🇧 EN)
- 헤더 우측 상단에 국기 버튼 추가 → 클릭 시 전체 UI + 안내문이 KR ⇄ EN 전환됩니다.
- 선택한 언어는 브라우저에 저장(localStorage)되어 다음 방문 시 유지됩니다.
- 대상 파일: `VIP_CRM.html`, `vip_dashboard.html`

## 2. 월간 세금 안내 탭 (📑 Tax)
새 탭 **세금 안내(Tax)** 추가. 한국 + UAE 세금 등록을 고객별로 관리합니다.

**세금 신고 D-day (자동 계산)**
| 구분 | 항목 | 기준 |
|------|------|------|
| UAE | 법인세 (Corporate Tax) | 회계연도(12/31) 종료 후 9개월 → 매년 9/30 |
| UAE | 부가세 (VAT) | 분기 종료 후 28일 |
| 한국 | 종합소득세 | 매년 5/31 |
| 한국 | 법인세 | 매년 3/31 |
| 월간 | 기장 자료 제출 마감 | 매월 10일 |
| 월간 | 국제 직원 급여 | 매월 25일 |
| 월간 | 운영비(오피스·라이센스) | 매월 1일 |

**고객별 관리**
- 🇰🇷 한국세금 / 🇦🇪 UAE세금 등록 토글
- 🧾 Invoice / 📝 Contract 상태 토글
- 기장 필요서류 체크리스트(은행내역·매출/매입·급여·계약서·VAT)
- **안내문 생성** → KR/EN 안내문 자동 작성 (D-day + 체크리스트 포함)

**발송 (Invoice + Contract + Email reminder)**
- 📋 복사 → 카카오/메일에 붙여넣기
- ✉️ 이메일 앱으로 열기 → 기본 메일 앱(mailto)에 수신자·제목·본문 자동 채움
- 🚀 이메일 자동발송(서버) → 아래 서버 설정 시 즉시 전송
- ✉️ 월간 안내문 일괄 발송 → 전체 고객 메일 패널에 자동 채움

## 3. 서버 이메일 자동발송 (server.js)
- `nodemailer` 추가. 신규 API:
  - `GET  /api/tax/events` — 세금 D-day·기장 목록
  - `POST /api/tax/send`   — 단일 이메일 발송 `{to, subject, body}`
  - `POST /api/tax/blast`  — 이메일 보유 고객 전체에게 월간 안내문 발송 `{lang}`

### 설정 방법 (Gmail 예시)
1. 터미널에서 폴더 이동 후: `npm install`  (nodemailer 설치)
2. Gmail → 2단계 인증 → **앱 비밀번호** 생성 (16자리)
3. 서버 실행(`node server.js` 또는 시작.bat) 후 Settings에서 아래 값 저장
   (또는 `data.json`의 `settings`에 직접 입력):
   ```json
   "settings": {
     "smtpUser": "your@gmail.com",
     "smtpPass": "앱비밀번호16자리",
     "smtpFrom": "your@gmail.com",
     "smtpHost": "smtp.gmail.com",
     "smtpPort": 465
   }
   ```
> ⚠️ 비밀번호/앱 비밀번호는 직접 입력해 주세요. (보안상 자동 입력하지 않습니다)

## 참고 — 원본 파일에 있던 버그도 함께 수정
`VIP_CRM.html`에는 원래 `toast()` 함수 정의와 최초 화면 렌더 호출(`renderAll()`)이
빠져 있어 페이지가 비어 보일 수 있었습니다. 이번 업데이트에서 두 가지를 추가해 정상 동작합니다.

## GitHub 반영
이 폴더의 `VIP_CRM.html`, `vip_dashboard.html`, `server.js`, `package.json`을
저장소(leadsspons/CRM)의 기존 파일에 덮어쓰기 후 커밋하시면 됩니다.
