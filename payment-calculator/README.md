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

## Thêm / sửa dự án

Mỗi dự án là một thư mục trong `data/`:

```
data/
  projects.ts               ← danh sách dự án hiển thị trong app
  serena-riverside/
    index.ts                ← chính sách: đơn giá, chiết khấu, các PTTT & tiến độ
    units.ts                ← danh sách căn (từ sheet SP)
```

Thêm dự án mới: copy thư mục `serena-riverside`, sửa số liệu, rồi thêm vào mảng `projects` trong `data/projects.ts`.
Một đợt thanh toán (`Milestone`) có các tùy chọn: `percent`, `amount` (số tiền cố định), `advance` / `deductAdvances` (cọc được trừ vào đợt sau),
`includeMaintenance` (cộng phí bảo trì), `remainder` (đợt cuối lấy phần còn lại), `payer: "bank"` (ngân hàng giải ngân), `monthsAfterContract` / `daysAfterContract` (ước tính ngày).

Chạy `npm test` sau khi sửa: test kiểm tra mọi PTTT của mọi dự án cộng đủ 100%.

## Chạy thử

```bash
npm install
npm run dev     # http://localhost:3000
npm test
```

## Deploy lên Vercel

1. Vào vercel.com → **Add New… → Project** → import repo GitHub này.
2. Mục **Root Directory** chọn `payment-calculator`. Framework tự nhận Next.js, không cần biến môi trường.
3. Bấm **Deploy**. Mỗi lần push lên nhánh chính Vercel tự deploy lại.
