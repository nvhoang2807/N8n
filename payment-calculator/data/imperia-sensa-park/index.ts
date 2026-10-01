import type { Project } from "../../lib/types";
import { blankMethod } from "../../lib/templates.ts";
import { units } from "./units.ts";

/**
 * Imperia Sensa Park (MIK Group) — danh sách 922 căn từ "Bang_Ma_Can_Ho_922_Can_Kem_Huong.xlsx".
 * File chưa có chính sách bán hàng (đơn giá, chiết khấu, tiến độ thanh toán) nên dự án để ẩn
 * với một PTTT tạm; cập nhật đơn giá & PTTT thật trong admin rồi bỏ ẩn.
 */
export const imperiaSensaPark: Project = {
  id: "imperia-sensa-park",
  name: "Imperia Sensa Park",
  developer: "MIK Group",
  location: "Đường Võ Chí Công, P. Phước Long, TP. HCM",
  description: "2 tháp Sensa A & Sensa B · 922 căn hộ",
  unitTypes: { Studio: "Studio", "1PN+": "Căn hộ 1PN+", "2PN": "Căn hộ 2PN", "3PN": "Căn hộ 3PN", Duplex: "Duplex" },
  defaultUnitPrice: {},
  vatRate: 0.1,
  maintenanceRate: 0.02,
  optionalDiscounts: [],
  units,
  methods: [{ ...blankMethod(), id: "pttt-chuan", name: "PTTT Chuẩn (tạm — chờ chính sách bán hàng)" }],
  notes: [
    "Giá trị trên bảng tính chỉ mang tính chất tham khảo, giá trị thực tế căn cứ theo Hợp đồng mua bán.",
  ],
  hidden: true,
};
