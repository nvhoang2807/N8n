import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Dự án lớn (vài nghìn căn) gửi từ trang admin có thể vượt mức mặc định 1MB
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
