import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
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
      <body>
        <header className="brand">
          <Link href="/" aria-label="Mapleland – trang chủ">
            <Image src="/logo.png" alt="Mapleland" width={552} height={396} priority />
          </Link>
        </header>
        {children}
      </body>
    </html>
  );
}
