import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

const font = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Bảng tạm tính giá căn hộ",
  description:
    "Chọn dự án, căn hộ và phương thức thanh toán để xem ước tính số tiền và lịch thanh toán.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#be1e2d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={font.variable}>
      <body>
        <header className="site-header">
          <div className="site-header-inner">
            <Link href="/" className="brand" aria-label="Mapleland – trang chủ">
              <Image src="/logo-horizontal.png" alt="Mapleland" width={576} height={160} priority />
            </Link>
            <span className="site-tagline">Bảng tính giá căn hộ</span>
          </div>
        </header>
        {children}
        <footer className="site-footer no-print">
          © {new Date().getFullYear()} Mapleland · Số liệu mang tính tham khảo, giá trị chính thức theo HĐMB.
        </footer>
      </body>
    </html>
  );
}
