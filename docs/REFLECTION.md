# BẢN THU HOẠCH DỰ ÁN (ONE-PAGE REFLECTION)
**Học phần:** Lập trình Mobile (TH7011101 — 23DTH1)  
**Đề tài:** Topic 03 — Field Notes (Sổ tay ghi chép thực địa Offline-First)  
**Trường:** Đại học Công nghệ Đồng Nai — Khoa CNTT  
**Nhóm sinh viên thực hiện:**
- **Tuấn Anh** (MSSV: `1923051085` — GitHub: `Tuananh165-art`)
- **Khải** (MSSV: `1923050402` — GitHub: `dinhkhaidev`)
- **Việt** (MSSV: `1923051115` — GitHub: `vitcondalon`)
- **Repository:** `https://github.com/Tuananh165-art/Field-Notes` — **Release Tag:** `v1.0.0`
- **Thời gian thực hiện:** 21/10/2026 – 27/10/2026 (7 ngày sprint)

---

### 1. BÀI HỌC VỀ THIẾT KẾ VÀ ĐIỀU NHÓM SẼ LÀM KHÁC ĐI (WHAT WE WOULD DO DIFFERENTLY)
Xây dựng ứng dụng **Offline-First** là một trải nghiệm kỹ thuật sâu sắc, đòi hỏi tư duy kiến trúc hoàn toàn khác so với ứng dụng CRUD online thông thường:
* **Điều nhóm đã làm tốt:** Nhóm đã giải quyết triệt để vấn đề mất mạng tại thực địa bằng cách coi SQLite cục bộ là *Single Source of Truth*. Mọi thao tác tạo, sửa ghi chú và chụp ảnh đều được nén lưu vĩnh viễn vào `FileSystem.documentDirectory` trước, sau đó đưa vào hàng đợi `sync_queue` để tự động đồng bộ khi có kết nối mạng. Cơ chế thử lại tối đa 3 lần và giao diện đối soát xung đột version giúp bảo toàn 100% dữ liệu của sinh viên.
* **Điều nhóm sẽ làm khác đi nếu làm lại từ đầu:** Nhóm nhận thấy việc chốt phiên bản thư viện ngay từ ngày đầu tiên là cực kỳ quan trọng. Ban đầu nhóm cấu hình Expo SDK 56, nhưng khi đưa lên thiết bị thật để chạy Expo Go thì ứng dụng báo lỗi SDK mismatch do ứng dụng Expo Go trên điện thoại đã cập nhật SDK mới hơn. Nhóm đã mất khá nhiều thời gian để đồng bộ lại toàn bộ dependency lên SDK mới. Ở các dự án sau, nhóm sẽ kiểm tra phiên bản Expo Go trên thiết bị thử nghiệm trước khi khởi tạo dự án để tránh tốn thời gian nâng cấp giữa chừng.

---

### 2. LỖI SAI CỦA TRỢ LÝ AI MÀ NHÓM ĐÃ PHÁT HIỆN VÀ SỬA (AI MISTAKE WE CAUGHT)
Trong quá trình phát triển, nhóm khai thác AI để gợi ý mã khung nhưng luôn đối chiếu chặt chẽ với bản yêu cầu kỹ thuật (Final Project Brief). Nhóm đã phát hiện và sửa chữa hai lỗi sai nghiêm trọng của AI:

1. **Lỗi sai về bảo mật phiên làm việc (Bắt bởi Tuấn Anh & Việt):**  
   Khi nhóm yêu cầu sinh mã lưu trữ session JWT sau khi đăng nhập, AI đã tự động sử dụng `@react-native-async-storage/async-storage`. Tuấn Anh và Việt đã phát hiện ngay lỗi này vì AsyncStorage chỉ lưu văn bản thuần không mã hóa, vi phạm nghiêm trọng yêu cầu bắt buộc của đề bài: *"Secrets in SecureStore only"*. Nhóm đã kiên quyết từ chối giải pháp của AI và tự tay cấu hình `expo-secure-store` để mã hóa và bảo vệ token an toàn trên phần cứng thiết bị.

2. **Lỗi sai về luồng từ chối quyền (Refusal Path) (Bắt bởi Khải):**  
   Khi xây dựng tính năng chụp ảnh và lấy toạ độ GPS tại thực địa, AI đã viết mã theo lối mòn thông thường: nếu người dùng ấn "Từ chối cấp quyền" (Permission Denied) Camera hoặc Location, AI lập tức hiện thông báo lỗi và **vô hiệu hóa nút Lưu, chặn không cho tạo ghi chú**. Khải đã phát hiện đề bài có một yêu cầu rất đặc thù: *"Every permission has a refusal path: if the camera or location is denied, the note can still be created another way."* Khải đã sửa lại toàn bộ luồng xử lý: khi bị từ chối quyền, ứng dụng chỉ đưa ra gợi ý nhẹ nhàng và vẫn mở form cho phép người dùng nhập văn bản bình thường để lưu lại quan sát thực địa mà không bị chặn lại.

---

### 3. KẾT LUẬN
Nhờ sự phân chia công việc rõ ràng và tinh thần làm chủ mã nguồn, cả 3 thành viên đều nắm vững toàn bộ kiến trúc từ Client đến Server, biến trợ lý AI thành công cụ gia tăng năng suất thay vì phụ thuộc thụ động.
