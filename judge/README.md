# Máy chấm thử nghiệm – Thầy Minh Chuyên Tin

Đây là bản MVP để kiểm chứng quy trình nộp và chấm bài C++ trước khi thuê VPS.

## Cách mở bằng GitHub Codespaces

1. Mở repository `vanminhk27/thayminhchuyentin` trên GitHub.
2. Chọn **Code → Codespaces → Create codespace on main**.
3. Chờ lần đầu khoảng vài phút để Codespaces tải môi trường Node.js và ảnh Docker GCC.
4. Khi cổng `3000` được chuyển tiếp, trang **Máy chấm thử nghiệm** sẽ tự mở.
5. Chọn bài, nhập mã C++ và bấm **Nộp bài chấm test**.

Cổng 3000 được giữ ở chế độ **Private** theo mặc định để giáo viên kiểm tra. Không chuyển cổng sang Public trong bản MVP vì hệ thống chưa có đăng nhập và giới hạn lượt nộp theo học sinh.

## Bản MVP hiện có

- Chấm thật C++17 với `g++`.
- Ba bài tập và test ẩn.
- Các kết quả: Accepted, Wrong Answer, Compilation Error, Runtime Error, Time Limit Exceeded và Output Limit Exceeded.
- Hàng đợi tối đa hai bài chấm đồng thời.
- Mỗi bài chạy trong Docker riêng, tắt mạng, giới hạn CPU, RAM, tiến trình và thời gian.
- Không làm lộ dữ liệu của test ẩn khi học sinh làm sai.

## Giới hạn của Codespaces

- Codespace sẽ tự dừng khi không sử dụng và không phải máy chủ chạy 24/7.
- Chưa có tài khoản học sinh, cơ sở dữ liệu hay lịch sử bài nộp lâu dài.
- Bản này dùng để giáo viên kiểm tra tính khả thi, không phải cấu hình production.
- Khi chuyển sang VPS, API và bộ chấm có thể được giữ lại; cần bổ sung PostgreSQL, đăng nhập, phân quyền và sao lưu.

## Chạy kiểm thử nội bộ

```bash
cd judge
npm test
```

Biến `JUDGE_RUNNER=host` trong lệnh kiểm thử chỉ phục vụ kiểm thử tự động. Không được mở host runner ra Internet; Codespaces luôn dùng `JUDGE_RUNNER=docker`.
