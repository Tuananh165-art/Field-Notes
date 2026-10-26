# Phân tích yêu cầu và kế hoạch Field Notes

## 1. Đọc đề và phạm vi

Sản phẩm là ứng dụng ghi chú khi đi khảo sát thực địa. Người dùng có thể đang ở nơi mất sóng, cần chụp ảnh, lấy vị trí và không được mất dữ liệu; ứng dụng phải đồng bộ khi có mạng trở lại.

Đề không bắt buộc một dịch vụ backend cụ thể. Vì luồng đồng bộ cần máy chủ, dự án này cung cấp API Go/Gin, xác thực JWT và PostgreSQL bằng Docker Compose. Ứng dụng vẫn tạo, đọc và xếp hàng ghi chú hoàn toàn cục bộ khi API vắng mặt.

## 2. Ma trận yêu cầu → thiết kế → bằng chứng

| Mức | Yêu cầu trong đề | Thiết kế thực hiện | Bằng chứng cần có |
|---|---|---|---|
| Bắt buộc | Đăng nhập/đăng xuất, giữ session, sign-out hoàn chỉnh | JWT và account ID trong SecureStore; xóa session/cache khi sign out; SQLite và queue gắn với account ID để không lộ chéo tài khoản | Kiểm tra khởi động lại app, đổi tài khoản và tiếp tục queue khi đăng nhập lại |
| Bắt buộc | Tạo note title/body, ảnh nén trong app storage, vị trí tùy chọn | Expo Image Picker + Image Manipulator; sao chép ảnh vào Documents; Expo Location; SQLite | Tạo note khi online/offline; từ chối quyền vẫn lưu được |
| Bắt buộc | Làm offline; queue và trạng thái từng note | SQLite note + sync_queue; trạng thái draft/queued/synced/failed/conflict; thử lại; lỗi sau 3 lần hiện rõ | Tắt mạng, tạo note, mở lại app, bật mạng, quan sát trạng thái |
| Bắt buộc | List/detail; detail mở bằng id từ deep link và notification tap | Expo Router `/notes/[id]`; URL `fieldnotes://notes/<id>`; notification chứa route | Mở route từ link và chạm notification |
| Bắt buộc | Lọc status và tìm trong title/body, tính khi render | Selector lọc thuần trên danh sách hiện có trong store/component render | Test pure logic cho filter/search |
| Bắt buộc | Từ chối camera/location vẫn tạo note được | Quyền là tùy chọn; thông báo giải thích và tiếp tục bằng ảnh/vị trí bỏ trống | Test trên thiết bị: deny từng quyền |
| Nên có | Bản đồ note có vị trí | Màn Map dùng react-native-maps; marker mở detail | Kiểm tra bản đồ trên iOS/Android |
| Nên có | Xử lý xung đột khi server đã sửa note | `version`/`updated_at`; sync trả conflict; app giữ bản local, hiển thị xung đột và cho tải bản server hoặc giữ bản của tôi | Tạo xung đột bằng hai client hoặc API |
| Nên có | Xuất note theo ngày thành file chia sẻ | CSV UTF-8, chọn ngày, Expo Sharing | Xuất và mở file trên thiết bị |
| Bổ sung an toàn dữ liệu | Tách dữ liệu local theo tài khoản; không tự gắn dữ liệu từ schema cũ | SQLite `owner_id`; Settings yêu cầu xác nhận nếu nhập nhóm ghi chú chưa phân tài khoản | Kiểm tra nhiều tài khoản và flow import trên thiết bị |
| Bắt buộc | Expo SDK 56+, TypeScript, Expo Router, function components/hooks | Expo SDK 56 + strict TS + file routes; function components | `npx tsc --noEmit`; `npx expo lint` |
| Bắt buộc | Tối thiểu 5 màn hình, dynamic route, modal route, not-found | Sign-in, sign-up, danh sách, bản đồ, cài đặt, chi tiết động, tạo note modal, `+not-found` | Route tree và kiểm tra điều hướng |
| Bắt buộc | Mỗi screen có loading/empty/error + retry/content | Screen state component dùng chung; retry chạy lại query/tác vụ | Component tests và kiểm thử lỗi mạng |
| Bắt buộc | Theme sáng/tối từ một token file, không có hex rải rác | `src/theme/tokens.ts`; NativeWind cấu hình semantic color palette lấy từ token | `rg '#[0-9a-fA-F]{3,8}' app src` chỉ được khớp file token |
| Bắt buộc | Accessibility: role/label, vùng chạm ≥44, tương phản ≥4.5:1 | Control dùng accessibilityRole/Label; kích thước tối thiểu 44; cặp màu được xác định trong token | Kiểm tra VoiceOver/TalkBack và tương phản |
| Bắt buộc | Store có selectors; API data-fetching library; secret ở SecureStore | Zustand selector hooks; TanStack Query; token chỉ qua SecureStore | Kiểm tra source và luồng session |
| Bắt buộc | strict TS, lint, 3 test (logic, component, critical path) | Jest + jest-expo; unit/component/integration test | Kết quả lệnh và thiết bị được ghi riêng |
| Bắt buộc | README chạy được trên máy sạch; AI_LOG cho cả team | README setup, env, Docker, demo; AI_LOG khai báo prompt/accept/reject | Đối chiếu setup từ checkout sạch |
| Bàn giao | Git tag/history, ZIP theo mẫu MSSV, video, reflection | Hướng dẫn và checklist ở README; không bịa MSSV, thành viên, lịch sử, video hay reflection | Team bổ sung thông tin và tự ghi nhận đóng góp thực tế |

## 3. Wireframe và hướng UI

### Điều hướng

```text
Sign in / Sign up
  └── App tabs: Notes | Map | Settings
        ├── Notes list → Note detail (/notes/[id])
        └── New note modal (/notes/new)
```

### Danh sách

```text
┌──────────────────────────────┐
│ FIELD NOTES          avatar  │
│ Keep the details.            │
│ [ Search title or body... ]  │
│ [All] [Draft] [Queued] [Done]│
│                              │
│ Latest   • 4 waiting          │
│ ┌ note card / photo / status┐│
│ └───────────────────────────┘
│                      [+]     │
│ Notes         Map     Settings│
└──────────────────────────────┘
```

### Tạo ghi chú (modal)

```text
New field note          Save
Title input (required)
Observation (required)
[ Add photo ]     [ Attach location ]
Offline status / queued hint
```

### Chi tiết

Ảnh rộng, trạng thái đồng bộ rõ, nội dung và tọa độ; nếu conflict thì hiển thị hai lựa chọn có giải thích. Hiệu ứng xuất hiện dùng opacity/translate ngắn; thẻ đầu trang có perspective/rotateY nhẹ khi nhấn, có thể tắt theo Reduce Motion.

### Hệ thống thiết kế

- Phong cách: nhật ký khảo sát hiện đại, nền giấy sáng và xanh mực; dark mode dùng nền than và bề mặt xanh đậm.
- Màu, radius, spacing, elevation tập trung trong `src/theme/tokens.ts`; không viết mã màu tại màn hình.
- NativeWind cung cấp utility classes Tailwind cho React Native. Dùng component nội bộ thay vì đưa shadcn/ui web vào native app.
- Chuyển động chỉ nhấn mạnh trạng thái và phản hồi; nội dung, thao tác, touch target vẫn dùng được khi giảm chuyển động.

## 4. Kế hoạch theo thứ tự phụ thuộc

1. Khung Expo, theme, route, auth flow, schema SQLite.
2. Ghi chú local: tạo, xem danh sách/chi tiết, search/filter, photo/location permission refusal.
3. Queue bền vững, retry/backoff tối đa ba lần, đồng bộ foreground/network, trạng thái lỗi rõ ràng.
4. Backend auth + note sync + conflict với PostgreSQL; cấu hình Docker Compose.
5. Bản đồ, CSV export/share, deep link và notification tap.
6. Accessibility, loading/empty/error/retry trên mỗi screen, animation/3D nhẹ.
7. Unit, component và critical-path tests; typecheck/lint/build; README/AI_LOG; kiểm tra thiết bị và chuẩn bị deliverables.

## 5. Lưu ý bảo toàn tính xác thực

Đề yêu cầu commit do các thành viên thực hiện trong hai tuần, demo video, reflection, URL repository/tag và tên/MSSV. Thông tin thành viên chưa được cung cấp và không thể tái tạo trung thực hoạt động đã diễn ra trong quá khứ. Dự án không giả mạo những phần này; README có checklist để nhóm hoàn thành bằng thông tin và bằng chứng thật.
