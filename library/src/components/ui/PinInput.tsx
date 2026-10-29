'use client';
import { useRef } from 'react';
import s from './ui.module.css';

export interface PinInputProps {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  label: string;
  /** e.g. (n) => `digit ${n} of 4` */
  digitLabel: (n: number) => string;
  invalid?: boolean;
  disabled?: boolean;
  length?: number;
}

/**
 * Four cells, always left-to-right — digits never mirror, even in Arabic (DESIGN.md).
 * Paste of the whole code fills every cell; Backspace on an empty cell moves back.
 */
export function PinInput({ value, onChange, onComplete, label, digitLabel, invalid, disabled, length = 4 }: PinInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');
  const toAscii = (t: string) => t.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '');

  function set(i: number, raw: string) {
    const clean = toAscii(raw);
    if (!clean) return;
    const next = (value.slice(0, i) + clean + value.slice(i + clean.length)).slice(0, length);
    onChange(next);
    const focusAt = Math.min(i + clean.length, length - 1);
    refs.current[focusAt]?.focus();
    if (next.length === length && !next.includes(' ')) onComplete?.(next);
  }

  return (
    <div role="group" aria-label={label} className={s.pin} dir="ltr" data-invalid={invalid || undefined}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          className={s.pinCell}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          pattern="[0-9]*"
          maxLength={length}
          aria-label={digitLabel(i + 1)}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          value={d}
          onChange={(e) => set(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault();
              if (d) onChange(value.slice(0, i) + value.slice(i + 1));
              else if (i > 0) { onChange(value.slice(0, i - 1) + value.slice(i)); refs.current[i - 1]?.focus(); }
            } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
            else if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => { e.preventDefault(); set(0, e.clipboardData.getData('text')); }}
        />
      ))}
    </div>
  );
}
