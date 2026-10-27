# NHẬT KÝ SỬ DỤNG TRỢ LÝ AI (AI_LOG)
**Học phần:** Lập trình Mobile (TH7011101 — 23DTH1) — Điểm trọng số: 50%  
**Đề tài:** Topic 03 — Field Notes (Offline-First Note Capture & Sync)  
**Trường:** Đại học Công nghệ Đồng Nai — Khoa Công nghệ Thông tin  
**Giảng viên phụ trách:** ThS. Nguyễn Xuân Vinh  
**Nhóm sinh viên thực hiện:**
1. **Tuấn Anh** (MSSV: `1923051085` — GitHub: `Tuananh165-art`) — Phụ trách Backend Docker, Go Gin, Theme tokens, Map View, Unit Test
2. **Khải** (MSSV: `1923050402` — GitHub: `dinhkhaidev`) — Phụ trách Form tạo ghi chú, Camera & FileSystem, GPS & Xử lý quyền, Chi tiết note, Component Test
3. **Việt** (MSSV: `1923051115` — GitHub: `vitcondalon`) — Phụ trách Giao diện Auth, SecureStore, Danh sách ghi chú, Lọc & Tìm kiếm, Xuất CSV, E2E Test, Tài liệu

---

## NGUYÊN TẮC SỬ DỤNG AI CỦA NHÓM
1. Nhóm sử dụng trợ lý AI (Gemini / Claude / ChatGPT) như một công cụ hỗ trợ tư vấn kiến trúc, gợi ý giải pháp và sinh mã khung (boilerplate) theo đúng tinh thần cho phép của đề bài.
2. Mọi đoạn mã AI tạo ra đều được 3 thành viên rà soát, kiểm thử trên máy local và đối chiếu nghiêm ngặt với barem yêu cầu kỹ thuật của đề.
3. Không phó mặc cho AI; kiên quyết từ chối các đề xuất không an toàn, sai lệch kiến trúc hoặc vi phạm quy định chấm thi.
4. Cả 3 thành viên đều nắm vững toàn bộ codebase để sẵn sàng cho phần Vấn đáp độc lập (Viva).

---

## 👤 PHẦN 1: NHẬT KÝ CỦA TUẤN ANH (`Tuananh165-art` — MSSV: 1923051085)

### Phiên 1 (21/10/2026) — Cấu trúc dự án và Token Theme Sáng / Tối
* **Câu hỏi / Yêu cầu đưa cho AI:**  
  *"Thiết lập dự án Expo SDK 58 với TypeScript strict mode, Expo Router và hệ thống token màu sáng/tối không được chứa mã hex rải rác ngoài codebase."*
* **Đề xuất của AI đã chấp nhận:**  
  - Cấu trúc thư mục chuẩn file-based routing của Expo Router.
  - File `src/theme/tokens.json` và `tokens.ts` định nghĩa các cặp màu semantic (`paper`, `surface`, `ink`, `brand`, `danger`) cho cả hai chế độ Light và Dark.
* **Đề xuất của AI đã từ chối & Lý do:**  
  - *Từ chối:* AI đề xuất dùng trực tiếp mã hex (ví dụ `#17665F`) trong các component bằng React Native `StyleSheet`.
  - *Lý do:* Đề bài cấm tuyệt đối: *"Light and dark colour schemes from one token file. No hex colour anywhere else in the codebase."* Tuấn Anh yêu cầu AI cấu hình qua NativeWind / Semantic tokens để toàn bộ app chỉ gọi tên biến màu ngữ nghĩa.
* **Cách tự kiểm chứng:**  
  - Chạy lệnh tìm kiếm regex `rg '#[0-9a-fA-F]{3,8}' app src` để đảm bảo mã hex chỉ xuất hiện duy nhất trong `tokens.json`.

---

### Phiên 2 (22/10/2026) — Hạ tầng Backend Go Gin, PostgreSQL và Docker Compose
* **Câu hỏi / Yêu cầu đưa cho AI:**  
  *"Dựng backend REST API bằng Go/Gin kết nối PostgreSQL chạy trong Docker Compose phục vụ đồng bộ dữ liệu cho ứng dụng mobile."*
* **Đề xuất của AI đã chấp nhận:**  
  - `Dockerfile` tối ưu hóa đa tầng (multi-stage build) và `docker-compose.yml` khởi chạy PostgreSQL 16 và API Go trên port 8080.
  - Endpoint `GET /health` kiểm tra kết nối database.
* **Đề xuất của AI đã từ chối & Lý do:**  
  - *Từ chối:* AI đề xuất để Docker context quét toàn bộ thư mục làm image nặng tới 394 MB do dính `.gocache` và `.gomodcache`.
  - *Lý do:* Làm chậm quá trình build và tốn tài nguyên. Tuấn Anh đã yêu cầu bổ sung `backend/.dockerignore` để đưa dung lượng context build giảm xuống còn dưới 1 KB.

---

### Phiên 3 (23/10/2026) — Lưu trữ SQLite Local, Bảo mật Session và Thuật toán Hàng đợi Sync
* **Câu hỏi / Yêu cầu đưa cho AI:**  
  *"Thiết kế bảng SQLite lưu trữ ghi chú cục bộ và hàng đợi sync bền vững; lưu session đăng nhập và cơ chế đếm lỗi thử lại."*
* **Đề xuất của AI đã chấp nhận:**  
  - Schema SQLite gồm 2 bảng `notes` và `sync_queue` trong `src/data/database.ts`.
  - Bổ sung trường `owner_id` để phân tách dữ liệu riêng biệt giữa các tài khoản đăng nhập trên cùng một thiết bị.
* **Đề xuất của AI đã từ chối & Lý do:**  
  - *Từ chối 1:* **AI đề xuất lưu JWT token bằng `@react-native-async-storage/async-storage`.** Tuấn Anh từ chối ngay lập tức vì AsyncStorage không mã hóa, vi phạm trực tiếp yêu cầu đề: *"Secrets in SecureStore only"*. Tuấn Anh yêu cầu viết module `sessionStorage.ts` bọc `expo-secure-store`.
  - *Từ chối 2:* AI đề xuất cơ chế đồng bộ ngầm bằng cách đặt `setInterval` thăm dò (polling) server liên tục 5 giây/lần. Tuấn Anh từ chối vì việc polling liên tục sẽ làm nóng máy và cạn pin điện thoại. Thay vào đó, Tuấn Anh đổi sang cơ chế lắng nghe sự kiện mạng (`expo-network`) và app foreground để kích hoạt sync.

---

### Phiên 4 (26/10/2026) — Kiểm thử Pure-Logic cho Sync Queue (`syncService.test.ts`)
* **Câu hỏi / Yêu cầu đưa cho AI:**  
  *"Viết bài test tự động (Pure-logic Unit test) kiểm thử thuật toán hàng đợi đồng bộ khi mạng bị ngắt kết nối."*
* **Đề xuất của AI đã chấp nhận:**  
  - Mock API trả lỗi mạng để kiểm tra hàm `syncPendingNotes()` tự động tăng biến đếm `attempts`.
  - Sau đúng **3 lần thất bại**, hàng đợi tự động ngắt và kích hoạt hàm `finishFailedSync`, đánh dấu trạng thái note là `failed` và hiển thị thông báo lỗi rõ ràng ra UI thay vì âm thầm bỏ qua.
* **Cách tự kiểm chứng:**  
  - Chạy `npm test -- syncService.test.ts` pass 100%.

---

## ⚡ PHẦN 2: NHẬT KÝ CỦA KHẢI (`dinhkhaidev` — MSSV: 1923050402)

### Phiên 1 (22/10/2026) — Cấu hình Cây điều hướng Expo Router và Modal Route
* **Câu hỏi / Yêu cầu đưa cho AI:**  
  *"Thiết lập cây thư mục định tuyến với ít nhất 5 màn hình, gồm 1 dynamic route theo ID và 1 modal route tạo note theo đúng Expo Router SDK 58."*
* **Đề xuất của AI đã chấp nhận:**  
  - Cấu trúc layout `app/_layout.tsx`, modal `app/notes/new.tsx`, dynamic route `app/notes/[id].tsx` và màn hình `app/+not-found.tsx`.

---

### Phiên 2 (24/10/2026) — Pipeline Nén ảnh, FileSystem và Luồng Từ Chối Quyền (Refusal Path)
* **Câu hỏi / Yêu cầu đưa cho AI:**  
  *"Tích hợp máy ảnh/thư viện ảnh, nén ảnh lưu vào bộ nhớ app, lấy GPS và xử lý trường hợp người dùng từ chối cấp quyền."*
* **Đề xuất của AI đã chấp nhận:**  
  - Dùng `expo-image-manipulator` để resize và nén ảnh JPEG giúp tối ưu dung lượng khi gửi qua mạng.
  - Sao chép ảnh từ thư mục cache tạm sang thư mục vĩnh viễn `FileSystem.documentDirectory` để không bị hệ điều hành tự động dọn dẹp mất ảnh.
* **Đề xuất của AI đã từ chối & Lý do (LỖI SAI QUAN TRỌNG CỦA AI BỊ BẮT):**  
  - *Từ chối:* Khi viết hàm xin quyền Camera và Location, **AI đề xuất: Nếu `status !== 'granted'` thì hiện Alert báo lỗi và khóa nút 'Lưu', không cho người dùng tạo note.**
  - *Lý do:* Đề bài yêu cầu rất nghiêm ngặt: *"Every permission has a refusal path: if the camera or location is denied, the note can still be created another way."* Khải đã kiên quyết từ chối code của AI và yêu cầu viết lại nhánh rẽ fallback: nếu từ chối camera/vị trí thì hiện cảnh báo giải thích nhẹ nhàng, nhưng form vẫn mở cho phép nhập Text và tạo Note bình thường mà không có ảnh hoặc toạ độ.
* **Cách tự kiểm chứng:**  
  - Mở Expo Go trên điện thoại thật, lần lượt ấn "Don't Allow" quyền Camera và Vị trí ➔ App vẫn lưu thành công ghi chú.

---

### Phiên 3 (25/10/2026) — API Notes CRUD và Thuật toán Giải quyết Xung đột (Conflict Resolution)
* **Câu hỏi / Yêu cầu đưa cho AI:**  
  *"Viết endpoint Go `POST /api/v1/notes/sync` tiếp nhận ghi chú và xử lý xung đột dữ liệu khi bản ghi trên server đã bị sửa trước."*
* **Đề xuất của AI đã chấp nhận:**  
  - Endpoint dùng Transaction `BeginTx` và khóa `FOR UPDATE` trong PostgreSQL.
  - Kiểm tra `n.Version != current.Version`: nếu lệch version thì không ghi đè mà trả về `status: "conflict"` kèm snapshot `ServerNote`.
  - Phía Mobile (`app/notes/[id].tsx`): Hiển thị modal so sánh 2 phiên bản và cho người dùng 2 lựa chọn: *"Tải bản từ máy chủ"* hoặc *"Giữ bản trên thiết bị"*.

---

### Phiên 4 (26/10/2026) — Deep Linking và Điều hướng Chạm Thông báo
* **Câu hỏi / Yêu cầu đưa cho AI:**  
  *"Cấu hình URL scheme để mở thẳng vào note detail theo ID và xử lý khi người dùng chạm vào Push Notification."*
* **Đề xuất của AI đã chấp nhận:**  
  - Cấu hình scheme `fieldnotes://notes/<id>` cho bản build native và URL `exp://` cho Expo Go.
  - Sử dụng `getLastNotificationResponseAsync()` để điều hướng chính xác khi app được mở từ trạng thái tắt hoàn toàn (cold-start), đồng thời gọi `clearLastNotificationResponseAsync()` để tránh bị lặp lại mở note cũ ở lần khởi động sau.

---

## 🛡️ PHẦN 3: NHẬT KÝ CỦA VIỆT (`vitcondalon` — MSSV: 1923051115)

### Phiên 1 (22/10 – 23/10/2026) — Giao diện Auth và Khung 4 Trạng Thái Màn Hình
* **Câu hỏi / Yêu cầu đưa cho AI:**  
  *"Xây dựng giao diện Đăng nhập, Đăng ký và đảm bảo mọi màn hình đều có đủ 4 trạng thái theo yêu cầu của trường."*
* **Đề xuất của AI đã chấp nhận:**  
  - Component `src/components/ui.tsx` chuẩn hóa 4 trạng thái: *Loading (vòng xoay), Empty (hình ảnh trống), Error (thông báo kèm nút Retry hoạt động thật), Content (nội dung chính)*.
  - Các màn hình `sign-in.tsx`, `sign-up.tsx`, `forgot-password.tsx` được tổ chức trong nhóm route `(auth)`.

---

### Phiên 2 (24/10/2026) — Bộ Lọc Trạng Thái và Tìm Kiếm Thời Gian Thực (Computed During Render)
* **Câu hỏi / Yêu cầu đưa cho AI:**  
  *"Viết bộ lọc theo trạng thái (draft, queued, synced, failed) và tìm kiếm tiêu đề/nội dung cho màn hình danh sách."*
* **Đề xuất của AI đã chấp nhận:**  
  - Hàm pure logic `filterNotes()` lọc chính xác danh sách ghi chú theo từ khóa và trạng thái.
* **Đề xuất của AI đã từ chối & Lý do (LỖI SAI QUAN TRỌNG CỦA AI BỊ BẮT):**  
  - *Từ chối:* **AI đề xuất dùng `useState` để lưu danh sách kết quả lọc và dùng hook `useEffect` lắng nghe ô tìm kiếm để `setFilteredList(...)`.**
  - *Lý do:* Cách làm này gây thừa re-render và vi phạm trực tiếp yêu cầu đề bài: *"Filter by status (draft, queued, synced) and search over title and body, computed during render."* Việt từ chối giải pháp `useEffect` và chuyển sang tính toán trực tiếp kết quả lọc ngay trong chu kỳ render (render-time computation qua Zustand selector / useMemo).
* **Cách tự kiểm chứng:**  
  - Chạy `npm test -- filterNotes.test.ts` pass toàn bộ các trường hợp tìm kiếm không dấu, chữ hoa, chữ thường.

---

### Phiên 3 (25/10 – 26/10/2026) — Bản đồ Map View và Xuất File CSV An Toàn
* **Câu hỏi / Yêu cầu đưa cho AI:**  
  *"Tích hợp react-native-maps cắm marker ghi chú và viết tính năng xuất ghi chú theo ngày ra file CSV chia sẻ."*
* **Đề xuất của AI đã chấp nhận:**  
  - Màn hình `app/(tabs)/map.tsx` cắm marker tại các vị trí có tọa độ, bấm vào marker sẽ mở chi tiết ghi chú.
* **Đề xuất của AI đã từ chối & Lý do:**  
  - *Từ chối:* AI đề xuất xuất file CSV bằng cách nối chuỗi dữ liệu thô.
  - *Lý do:* Nếu người dùng nhập tiêu đề ghi chú bắt đầu bằng các ký tự `=`, `+`, `-`, `@` thì khi mở file trong Microsoft Excel sẽ bị dính lỗ hổng **CSV Formula Injection**. Việt yêu cầu viết hàm `csvEscape` bao bọc dấu nháy kép và thêm tiền tố nháy đơn `'` để trung hòa công thức độc hại. Đồng thời, Việt sửa logic lọc ngày theo múi giờ địa phương của máy thay vì dùng giờ UTC để tránh lệch ngày vào nửa đêm.

---

### Phiên 4 (27/10/2026) — Kiểm soát Tiêu chuẩn Trợ năng (Accessibility) và Critical Path Test
* **Câu hỏi / Yêu cầu đưa cho AI:**  
  *"Kiểm tra tiêu chuẩn trợ năng trên toàn bộ ứng dụng và viết bài test hành trình nghiệp vụ (Critical Path Test)."*
* **Đề xuất của AI đã chấp nhận:**  
  - Đảm bảo tất cả các nút bấm, icon thao tác đều có `minHeight: 44`, `minWidth: 44` (chuẩn touch target 44x44).
  - Gắn đầy đủ `accessibilityRole` và `accessibilityLabel` bằng tiếng Việt rõ nghĩa cho từng control.
  - Kiểm tra độ tương phản giữa chữ và nền trên cả 2 theme Light/Dark đều vượt mức **4.5:1** theo chuẩn WCAG AA.
  - Viết bài test tích hợp `database.auth-recovery.test.js` kiểm tra khôi phục lỗi khi đồng bộ.

---

## 📊 TỔNG KẾT BÀN GIAO VÀ PHÂN CHIA HIỂU BIẾT
* **Mức độ phụ thuộc AI:** Nhóm tận dụng AI cho phần viết code khung (boilerplate) và tư vấn tài liệu, nhưng nhóm làm chủ 100% logic nghiệp vụ, sửa đổi các đề xuất sai của AI và tự tay chạy nghiệm thu trên máy.
* **Sẵn sàng cho vấn đáp cá nhân (Viva):** Cả Tuấn Anh, Khải và Việt đều nắm rõ chéo code của nhau:
  - Tuấn Anh có thể giải thích luồng Refusal Path và Export CSV.
  - Khải có thể giải thích cấu trúc Docker Go và Sync Retry 3 lần.
  - Việt có thể giải thích thuật toán Transaction Conflict Version ở Backend.
