"use client";

import { useId, useMemo, useState } from "react";

export type UnitOption = { code: string; detail: string };

const MAX_SHOWN = 5;

/** Bỏ dấu gạch, khoảng trắng để "a0401" khớp "A-04-01" */
export const normalizeCode = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Ô nhập mã căn kèm gợi ý: gõ để lọc, chỉ hiện tối đa 5 căn khớp nhất */
export default function UnitPicker({
  value,
  options,
  onChange,
  allowCustom,
}: {
  value: string;
  options: UnitOption[];
  onChange: (code: string) => void;
  /** Dự án cho nhập căn ngoài danh sách */
  allowCustom?: boolean;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    const q = normalizeCode(value);
    if (!q) return options;
    const starts: UnitOption[] = [];
    const contains: UnitOption[] = [];
    for (const o of options) {
      const c = normalizeCode(o.code);
      if (c.startsWith(q)) starts.push(o);
      else if (c.includes(q)) contains.push(o);
    }
    return [...starts, ...contains];
  }, [value, options]);

  const shown = matches.slice(0, MAX_SHOWN);
  const exact = !!value.trim() && options.some((o) => normalizeCode(o.code) === normalizeCode(value));
  // Đã chọn đúng một căn thì không cần mở gợi ý nữa
  const visible = open && !(exact && matches.length === 1);

  const choose = (code: string) => {
    onChange(code);
    setOpen(false);
  };

  return (
    <div className="unit-picker">
      <input
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        placeholder={options[0] ? `Gõ để tìm, VD: ${options[0].code}` : "Nhập mã căn"}
        onFocus={(e) => {
          e.target.select();
          setOpen(true);
          setActive(0);
        }}
        onBlur={() => {
          setOpen(false);
          // Đưa mã gõ tắt ("b0602") về đúng mã căn ("B-06-02")
          const hit = options.find((o) => normalizeCode(o.code) === normalizeCode(value));
          if (hit && hit.code !== value) onChange(hit.code);
        }}
        onChange={(e) => {
          onChange(e.target.value.toUpperCase());
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            if (shown.length) {
              const step = e.key === "ArrowDown" ? 1 : -1;
              setActive((a) => (a + step + shown.length) % shown.length);
            }
          } else if (e.key === "Enter" && visible && shown[active]) {
            e.preventDefault();
            choose(shown[active].code);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {visible && (
        <ul className="suggestions" id={listId} role="listbox">
          {shown.map((o, i) => (
            <li
              key={o.code}
              role="option"
              aria-selected={i === active}
              className={i === active ? "active" : ""}
              // mousedown để chọn trước khi ô nhập mất focus
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o.code);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <strong>{o.code}</strong>
              <span>{o.detail}</span>
            </li>
          ))}
          {matches.length > MAX_SHOWN && (
            <li className="more" aria-disabled>
              Còn {matches.length - MAX_SHOWN} căn khác — gõ thêm để lọc
            </li>
          )}
          {matches.length === 0 && (
            <li className="more" aria-disabled>
              {allowCustom
                ? "Căn ngoài danh sách — điền loại căn, diện tích và đơn giá ở các ô bên cạnh"
                : "Không có mã căn phù hợp"}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
