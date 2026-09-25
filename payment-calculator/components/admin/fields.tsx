"use client";

import { useEffect, useRef, useState } from "react";
import { fromPercentText, parseNumber, toPercentText } from "@/lib/numbers.ts";

const vnd = new Intl.NumberFormat("vi-VN");

type NumberFieldProps = {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  /** Hiển thị dấu chấm ngăn cách hàng nghìn khi không sửa */
  money?: boolean;
  placeholder?: string;
  className?: string;
  title?: string;
};

/** Ô nhập số: giữ nguyên chuỗi đang gõ, chỉ định dạng lại khi rời ô */
export function NumberField({ value, onChange, money, placeholder, className, title }: NumberFieldProps) {
  const format = (v: number | undefined) => (v === undefined ? "" : money ? vnd.format(v) : String(v));
  const [text, setText] = useState(format(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(format(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, money]);

  return (
    <input
      className={className}
      title={title}
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        setText(format(value));
      }}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseNumber(e.target.value));
      }}
    />
  );
}

type PercentFieldProps = {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  className?: string;
  placeholder?: string;
};

/** Ô nhập phần trăm: người dùng gõ 9,9 → lưu 0.099 */
export function PercentField({ value, onChange, className, placeholder }: PercentFieldProps) {
  const [text, setText] = useState(toPercentText(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(toPercentText(value));
  }, [value]);

  return (
    <span className={`suffix ${className ?? ""}`}>
      <input
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          setText(toPercentText(value));
        }}
        onChange={(e) => {
          setText(e.target.value);
          onChange(fromPercentText(e.target.value));
        }}
      />
      <span>%</span>
    </span>
  );
}

/** Danh sách các mức % cách nhau dấu chấm phẩy, ví dụ "0; 1; 1,5" */
export function PercentListField({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const format = (v: number[]) => v.map(toPercentText).join("; ");
  const [text, setText] = useState(format(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(format(value));
  }, [value]);

  return (
    <input
      value={text}
      placeholder="VD: 0; 1; 1,5"
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        setText(format(value));
      }}
      onChange={(e) => {
        setText(e.target.value);
        onChange(
          e.target.value
            .split(/[;|/]/)
            .map((s) => fromPercentText(s))
            .filter((n): n is number => n !== undefined),
        );
      }}
    />
  );
}

/** Nút nhỏ di chuyển / xóa phần tử trong danh sách */
export function RowTools({
  index,
  length,
  onMove,
  onRemove,
  onDuplicate,
}: {
  index: number;
  length: number;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  onDuplicate?: (index: number) => void;
}) {
  return (
    <span className="row-tools">
      <button type="button" title="Lên" disabled={index === 0} onClick={() => onMove(index, index - 1)}>
        ↑
      </button>
      <button type="button" title="Xuống" disabled={index === length - 1} onClick={() => onMove(index, index + 1)}>
        ↓
      </button>
      {onDuplicate && (
        <button type="button" title="Nhân bản" onClick={() => onDuplicate(index)}>
          ⧉
        </button>
      )}
      <button type="button" title="Xóa" className="danger" onClick={() => onRemove(index)}>
        ✕
      </button>
    </span>
  );
}

export function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
