import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bảng tạm tính giá căn hộ",
  description:
    "Chọn dự án, căn hộ và phương thức thanh toán để xem ước tính số tiền và lịch thanh toán.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
