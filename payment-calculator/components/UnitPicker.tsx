"use client";

import { useId, useMemo, useRef, useState } from "react";

export type UnitOption = { code: string; detail: string };

const MAX_SHOWN = 5;

/** Bỏ dấu gạch, khoảng trắng để "a0401" khớp "A-04-01" */
export const normalizeCode = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Ô mã căn dạng xổ xuống: bấm vào là hiện tối đa 5 căn, gõ mã để lọc.
 * Mở ra lần đầu hiện các căn đầu danh sách (không lọc theo mã đang chọn),
 * chỉ lọc khi người dùng bắt đầu gõ.
 */
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  /** null = vừa mở, chưa gõ gì → chưa lọc */
  const [query, setQuery] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = normalizeCode(query ?? "");
    if (!q) return options;
    const starts: UnitOption[] = [];
    const contains: UnitOption[] = [];
    for (const o of options) {
      const c = normalizeCode(o.code);
      if (c.startsWith(q)) starts.push(o);
      else if (c.includes(q)) contains.push(o);
    }
    return [...starts, ...contains];
  }, [query, options]);

  const shown = matches.slice(0, MAX_SHOWN);

  const openList = () => {
    setQuery(null);
    setOpen(true);
    const current = options.findIndex((o) => normalizeCode(o.code) === normalizeCode(value));
    setActive(current >= 0 && current < MAX_SHOWN ? current : 0);
  };

  const choose = (code: string) => {
    onChange(code);
    setOpen(false);
  };

  return (
    <div className={`unit-picker${open ? " open" : ""}`}>
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        placeholder="Chọn hoặc nhập mã căn"
        onFocus={(e) => {
          e.target.select();
          openList();
        }}
        onClick={() => !open && openList()}
        onBlur={() => {
          setOpen(false);
          // Đưa mã gõ tắt ("b0602") về đúng mã căn ("B-06-02")
          const hit = options.find((o) => normalizeCode(o.code) === normalizeCode(value));
          if (hit && hit.code !== value) onChange(hit.code);
        }}
        onChange={(e) => {
          const v = e.target.value.toUpperCase();
          onChange(v);
          setQuery(v);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) return openList();
            if (shown.length) {
              const step = e.key === "ArrowDown" ? 1 : -1;
              setActive((a) => (a + step + shown.length) % shown.length);
            }
          } else if (e.key === "Enter" && open && shown[active]) {
            e.preventDefault();
            choose(shown[active].code);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      <button
        type="button"
        className="picker-toggle"
        tabIndex={-1}
        aria-label={open ? "Đóng danh sách căn" : "Mở danh sách căn"}
        // mousedown để không làm ô nhập mất focus
        onMouseDown={(e) => {
          e.preventDefault();
          if (open) setOpen(false);
          else {
            inputRef.current?.focus();
            openList();
          }
        }}
      >
        ▾
      </button>
      {open && (
        <ul className="suggestions" id={listId} role="listbox">
          {shown.map((o, i) => (
            <li
              key={o.code}
              role="option"
              aria-selected={i === active}
              className={[i === active ? "active" : "", o.code === value ? "current" : ""].join(" ").trim()}
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
              Còn {matches.length - MAX_SHOWN} căn khác — gõ mã căn để lọc
            </li>
          )}
          {matches.length === 0 && (
            <li className="more" aria-disabled>
              {allowCustom
                ? "Căn ngoài danh sách — điền loại căn, diện tích và đơn giá ở các ô bên cạnh"
                : "Không có mã căn phù hợp"}
            </li>
          )}
          {allowCustom && matches.length > 0 && (
            <li className="more" aria-disabled>
              Căn khác: gõ mã căn rồi điền loại căn, diện tích, đơn giá
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
