# Field Notes — Offline-First Field Journal

**Trường Đại học Công nghệ Đồng Nai — Khoa Công nghệ Thông tin**  
**Học phần:** Lập trình Mobile (Mã lớp: TH7011101 — Lớp: 23DTH1) — Trọng số: 50%  
**Giảng viên hướng dẫn:** ThS. Nguyễn Xuân Vinh  
**Đề tài:** Topic 03 — Field Notes (Sổ tay ghi chép thực địa ngoại tuyến và đồng bộ)  
**Repository URL:** [https://github.com/Tuananh165-art/Field-Notes](https://github.com/Tuananh165-art/Field-Notes) — **Release Tag:** `v1.0.0`

### Nhóm sinh viên thực hiện:
| STT | Thành viên | MSSV | Tài khoản GitHub | Phụ trách chính |
|:---:|---|:---:|---|---|
| 1 | **Tuấn Anh** | `1923051085` | `Tuananh165-art` | Backend Docker & Go Gin, Theme tokens, Bản đồ (Map View), Unit Test (`syncService.test.ts`), Quản lý Release Tag `v1.0.0`. |
| 2 | **Khải** | `1923050402` | `dinhkhaidev` | Form tạo ghi chú, Camera & Nén ảnh `FileSystem`, GPS & Xử lý quyền, Màn chi tiết `[id]`, Component Test. |
| 3 | **Việt** | `1923051115` | `vitcondalon` | Màn hình Auth & `SecureStore`, Danh sách ghi chú & Tìm kiếm/Lọc lúc render, Xuất file CSV theo ngày, Accessibility 44x44, E2E Test, README & AI_LOG. |

---

## Giới thiệu Sản phẩm (Product Overview)

Field Notes là ứng dụng di động ngoại tuyến (Offline-First) phục vụ sinh viên đi khảo sát thực địa tại các khu vực mất sóng. Ứng dụng ưu tiên lưu trữ quan sát cục bộ vào SQLite trên máy trước, nén và sao chép ảnh vào thư mục lưu trữ ứng dụng (`FileSystem.documentDirectory`), lấy toạ độ GPS (tùy chọn), và tự động đồng bộ lên máy chủ REST API (Go Gin + PostgreSQL) ngay khi có mạng trở lại.

The requirements and implementation plan are mapped in [docs/REQUIREMENTS_AND_PLAN.md](docs/REQUIREMENTS_AND_PLAN.md). The source brief is [FinalProject_Topic03_Field_Notes.docx](FinalProject_Topic03_Field_Notes.docx). This project targets Expo SDK 58, React Native 0.88.0 and React 19.3.0; Expo Router follows file-based routing.

## Features

- Sign up, sign in, persistent JWT session and account ID in SecureStore, with local notes and sync queue scoped to the authenticated account.
- Notes left unassigned by the previous local schema stay hidden until the user explicitly imports them into the current account; this avoids silently attaching ambiguous legacy data to whichever account signs in first.
- Create and edit a title/body note offline; camera/library images are resized, compressed and copied under app document storage. Denying camera, library, or location permission does not block saving.
- SQLite-backed notes and sync queue survive app restarts. Signed-in notes sync when the app returns to foreground, connectivity returns, or a note is retried. Three unsuccessful attempts become a visible `failed` state; manual retry is available.
- Per-note draft, queued, synced, failed, and conflict states; stale server versions are kept as a separate snapshot until the user chooses the server or local version.
- Search title/body and filter by status, with results computed from the current collection during render.
- Map markers for notes with a saved coordinate. Marker taps open note details.
- `/notes/[id]` detail route, a share-link action that creates the correct Expo Go/native URL, and local notification taps. Installed native builds use `fieldnotes://notes/<id>`; while testing in Expo Go, use the Metro development URL `exp://<host>:<port>/--/notes/<id>`.
- Export one local calendar day of notes to UTF-8 CSV and share the generated file; date boundaries follow the device timezone, invalid dates are rejected, and formula prefixes are neutralized for spreadsheet safety.
- Tap the avatar in Settings for sign-in/sign-out and to choose a photo from the device. The avatar is stored locally for the current account and is not synchronized to the server or other devices.
- Light/dark/system theme from one token source, accessible labels and native touch targets, subtle perspective card motion, and native route transitions.

## Screens and routes

| Screen | Route | Purpose |
|---|---|---|
| Sign in | `/(auth)/sign-in` | Restore an existing server session |
| Sign up | `/(auth)/sign-up` | Create an account |
| Notes | `/(tabs)` | Search, filter, sync status and open notes |
| Map | `/(tabs)/map` | Browse located observations |
| Settings | `/(tabs)/settings` | Account menu, local avatar, theme and CSV export |
| Note detail | `/notes/[id]` | Dynamic detail, edit, share link, retry, resolve conflict |
| New/edit note | `/notes/new` | Capture modal; `editId` opens an existing note |
| Not found | `+not-found` | Unknown route recovery |

## Architecture

```text
Expo Router mobile app
  ├── NativeWind/Tailwind UI + token-based theme + Expo System UI
  ├── Zustand selectors: session, search, filter, theme, local collection
  ├── TanStack Query: local reads and API synchronization/cache
  ├── SQLite: notes + durable sync queue
  ├── SecureStore: JWT + account ID; local SQLite records and queue scoped by account ID
  └── Expo camera, image, location, notification and share APIs
             │ HTTPS/JSON + bearer JWT (configure API URL)
             ▼
Go + Gin API ── PostgreSQL
```

Go/Gin and PostgreSQL were selected because note synchronization needs an API and the project request asks for them when a backend fits. The backend uses bcrypt password hashes, 24-hour HS256 access tokens, per-user note ownership and version checks. PostgreSQL is persisted in a named Docker volume. Local note capture remains available when the server is down.

### Sync behavior

1. A signed-in note is committed locally and added to `sync_queue` before the network request.
2. Success updates the local server version and removes the queue entry.
3. A stale version returns the server snapshot and a conflict state. The detail screen offers **Tải bản từ máy chủ** or **Giữ bản trên thiết bị**.
4. Transient errors increment attempts, retry with a short increasing delay, and stop after three attempts. The note remains locally available and shows the error. Manual retry is available.
5. Sign out deletes the token and account ID and clears the query cache. Notes and pending queue entries remain linked to that account, stay hidden from other accounts on the device, and resume when the same account signs in again.
6. If notes from an older app version have no account ID, Settings offers an explicit import. The older schema cannot separate those notes by prior account, so the user chooses which account should own the whole unassigned set.

### Photo transfer

To avoid storing large images directly inside JSON payloads or database strings without limit:

- Captured photos are copied into the app's document directory (`FileSystem.documentDirectory`).
- Photos are compressed and resized to a maximum of 1280px dimension using `expo-image-manipulator`.
- The local SQLite record points to the private file URI.
- The sync engine serializes the image as a Base64 data URI for transmission; the Go API body parser enforces an 8 MiB limit.

### Local data

SQLite tables are created on first launch:

```sql
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  photo_uri TEXT,
  lat REAL,
  lng REAL,
  sync_error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  server_snapshot TEXT
);

CREATE TABLE IF NOT EXISTS sync_queue (
  note_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  enqueued_at TEXT NOT NULL
);
```

### Security

- JWT access tokens and account IDs are kept in hardware-backed `expo-secure-store`.
- No plain-text secrets or passwords exist in SQLite or local state.
- Sensitive environment variables are separated into `.env.example`.

## Docker and Backend API

Run the Go API and PostgreSQL with Docker Compose:

```powershell
docker compose up -d --build
```

Health check:

```powershell
Invoke-RestMethod http://localhost:8080/health
```

Endpoints:

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | No | Database connection ping |
| POST | `/api/v1/auth/register` | No | Creates a user account with hashed password |
| POST | `/api/v1/auth/login` | No | Returns JWT for valid credentials |
| POST | `/api/v1/auth/password-reset/request` | No | Requests a reset email |
| POST | `/api/v1/auth/password-reset/confirm` | No | Changes password with reset code |
| GET | `/api/v1/notes` | Bearer JWT | Lists notes owned by the signed-in user |
| GET | `/api/v1/notes/:id` | Bearer JWT | Reads one owned note |
| POST | `/api/v1/notes/sync` | Bearer JWT | Upserts by owner/note ID and detects stale versions |

## Checks and tests

Run automated tests and checks:

```powershell
npm run typecheck
npm run lint
npm test
```

The three test categories are represented by:

- **Pure logic:** `src/services/syncService.test.ts` (Sync queue failure and 3-attempt limit) & `src/utils/filterNotes.test.ts`
- **Component/accessibility:** `src/components/NoteCard.test.tsx` & `src/components/StatusPill.test.tsx`
- **Critical sync path:** `src/data/database.auth-recovery.test.js` & End-to-end sync verification

Backend checks:

```powershell
Push-Location backend
go test ./...
go vet ./...
Pop-Location
```

## Hồ sơ Bàn giao Đồ án (Deliverables Checklist)

Đồ án hoàn tất đầy đủ 100% các hạng mục bàn giao theo đúng yêu cầu đề bài:

1. **Repository GitHub & Tagged Release:**
   - URL: [https://github.com/Tuananh165-art/Field-Notes](https://github.com/Tuananh165-art/Field-Notes)
   - Tagged Release: `v1.0.0`
   - Lịch sử Git: 24 commits rải đều từ ngày 21/10/2026 đến 27/10/2026 cho cả 3 thành viên Tuấn Anh, Khải và Việt.
2. **File nén mã nguồn Canvas:**
   - Tên file: `1923051085_1923050402_1923051115_Project.zip` (loại trừ `node_modules`, `.git` và thông tin bảo mật).
   - Đóng gói bằng script: `.\scripts\package-submission.ps1 -OutputFile 1923051085_1923050402_1923051115_Project.zip`.
3. **Nhật ký AI (AI_LOG.md):**
   - Nhật ký chi tiết phân theo 3 thành viên: Yêu cầu đưa cho AI, Phần đã chấp nhận, Phần đã từ chối kèm lý do kỹ thuật.
4. **Bản thu hoạch 1 trang (One-Page Reflection):**
   - Tài liệu tại [docs/REFLECTION.md](docs/REFLECTION.md) ghi nhận bài học kinh nghiệm và các lỗi sai thực tế của AI mà nhóm đã phát hiện và sửa.
5. **Video Demo (3–5 phút):**
   - Kịch bản quay video chuẩn bị theo [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) minh họa các luồng Offline-first, chụp ảnh, GPS, Sync Queue, Bản đồ và Xuất CSV.
