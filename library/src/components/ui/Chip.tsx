'use client';
import { ToggleButton, type ToggleButtonProps } from 'react-aria-components';
import { X } from 'lucide-react';
import s from './ui.module.css';

export interface ChipProps extends Omit<ToggleButtonProps, 'children'> {
  label: React.ReactNode;
  /** When set, the chip shows a remove affordance and calls this instead of toggling. */
  onRemove?: () => void;
  removeLabel?: string;
}

/** Filter chip for the always-visible filter bar: shows its value, removable in one click. */
export function Chip({ label, onRemove, removeLabel, className, ...rest }: ChipProps) {
  if (onRemove) {
    return (
      <span className={[s.chip, s.chipActive, typeof className === 'string' ? className : ''].join(' ')}>
        <span>{label}</span>
        <button type="button" className={s.chipRemove} aria-label={removeLabel ?? 'remove'} onClick={onRemove}>
          <X size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </span>
    );
  }
  return (
    <ToggleButton {...rest} className={[s.chip, typeof className === 'string' ? className : ''].join(' ')}>
      {label}
    </ToggleButton>
  );
}
