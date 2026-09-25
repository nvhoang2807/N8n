# Bảng tạm tính giá căn hộ

App web (Next.js, deploy lên Vercel) giúp nhân viên kinh doanh cho khách xem:

1. **Chọn dự án → chọn mã căn** (tự lấy loại căn, số PN/WC, hướng, DT tim tường, DT thông thủy)
2. **So sánh tất cả phương thức thanh toán (PTTT)** trên một bảng: tổng giá trị HĐMB, số tiền tiết kiệm, số tiền cần có khi ký HĐMB, phần ngân hàng cho vay
3. **Chi tiết giá trị** từng bước: giá công bố → chiết khấu → tiền sử dụng đất → VAT → phí bảo trì → tổng HĐMB
4. **Lịch thanh toán** từng đợt (số tiền, tỷ lệ, lũy kế, tháng dự kiến nếu nhập ngày ký HĐMB)
5. **Ước tính khoản vay** với PTTT vay: tiền trả hàng tháng trong và sau thời gian hỗ trợ lãi suất
6. **Sao chép link** (link giữ nguyên lựa chọn để gửi Zalo cho khách) và **In / Lưu PDF**

## Cách tính (khớp file Excel của chủ đầu tư)

| # | Khoản | Công thức |
|---|---|---|
| 1 | Giá công bố | Đơn giá × DT tim tường (hoặc giá cố định từng căn) |
| 2 | CK sỉ, Early Bird | % × (1) |
| 3 | CK theo PTTT | % × [(1) − (2)] |
| 4 | Giá sau CK | (1) − (2) − (3) |
| 5 | Tiền sử dụng đất | DT thông thủy × đơn giá tiền SDĐ |
| 6 | VAT | [(4) − (5)] × 10% |
| 7 | Giá gồm VAT | (4) + (6) |
| 8 | Phí bảo trì | (4) × 2% |
| 9 | Tổng giá trị HĐMB | (7) + (8) |

Các đợt tính theo % của (7). Cọc và VBTT được trừ dần vào Đợt 1; đợt bàn giao cộng phí bảo trì; đợt cuối = (9) − các đợt trước.
`lib/calc.test.ts` đối chiếu từng con số với file `SRN_BẢNG TẠM TÍNH GIÁ_Final.xlsx` (căn A-04-01, PTTTN 70%).

## Quản trị dữ liệu (`/admin`)

Mọi thông tin dự án sửa trực tiếp trên web, không cần sửa code:

- **Danh sách dự án**: tạo mới, nhân bản (tiện khi dự án mới giống dự án cũ), ẩn/hiện, xóa, sắp thứ tự.
- **Thông tin chung**: tên, chủ đầu tư, VAT, phí bảo trì, đơn giá tiền SDĐ, loại sản phẩm + đơn giá mặc định, chiết khấu tùy chọn (CK sỉ, Early Bird…), ghi chú cho khách.
- **Căn hộ**: copy các cột từ Excel (Mã căn | Loại | Số PN | Số WC | Hướng | DT tim tường | DT thông thủy | Giá công bố nếu có) rồi dán vào → thay toàn bộ hoặc cập nhật theo mã căn. Sửa/xóa từng căn, tìm theo mã.
- **Phương thức thanh toán**: thêm, nhân bản, sắp xếp PTTT; sửa chiết khấu, từng đợt (tỷ lệ hoặc số tiền, cọc/ứng trước, cộng phí bảo trì, đợt còn lại, ngân hàng giải ngân), chính sách vay.
- **Xem trước số tiền** theo căn bất kỳ để đối chiếu với Excel của chủ đầu tư, và **kiểm tra lỗi tự động** (tổng tỷ lệ ≠ 100%, trùng mã căn, đợt bị âm…) — còn lỗi thì không cho lưu.
- **Sao lưu**: tải/nạp file JSON của từng dự án.

Bấm **Lưu** là trang khách cập nhật ngay.

Dữ liệu lưu trên **Vercel Blob**, mỗi dự án một file `projects/<mã-dự-án>.json`. Khi Blob còn trống, app dùng dữ liệu mặc định trong `data/` (Serena Riverside + 1 dự án mẫu đang ẩn); lần lưu đầu tiên sẽ tự chép toàn bộ lên Blob.

## Deploy lên Vercel

1. Vào vercel.com → **Add New… → Project** → import repo GitHub này.
2. **Root Directory** chọn `payment-calculator`. Framework tự nhận Next.js.
3. **Environment Variables**: thêm `ADMIN_PASSWORD` = mật khẩu đăng nhập trang admin (đặt mật khẩu mạnh).
4. Bấm **Deploy**.
5. Vào project → tab **Storage** → **Create Database** → chọn **Blob** → chọn **Private** → **Connect** vào project này (Vercel tự thêm biến `BLOB_READ_WRITE_TOKEN`).
6. Vào tab **Deployments** → **Redeploy** bản mới nhất để nhận biến môi trường.
7. Mở `https://<tên-app>.vercel.app/admin`, đăng nhập và bắt đầu nhập dự án.

> Nếu lỡ tạo Blob store kiểu **Public**, thêm biến `BLOB_ACCESS=public`.

## Chạy thử trên máy

```bash
npm install
ADMIN_PASSWORD=123 LOCAL_STORE_DIR=.data npm run dev   # lưu dữ liệu vào thư mục .data thay cho Blob
npm test
```

## Cấu trúc code

```
app/page.tsx                  trang chủ: danh sách dự án
app/[projectId]/page.tsx      bảng tính cho khách
app/admin/…                   trang quản trị + server actions (đăng nhập, lưu, xóa)
components/Calculator.tsx     giao diện bảng tính
components/admin/…            giao diện quản trị
lib/calc.ts                   công thức tính (có test đối chiếu Excel)
lib/validate.ts               kiểm tra cấu hình dự án
lib/store.ts                  đọc/ghi Vercel Blob (+ cache)
data/                         dữ liệu mặc định ban đầu
```
