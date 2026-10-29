'use client';
import { ToggleButtonGroup, ToggleButton, type Key } from 'react-aria-components';
import s from './ui.module.css';

export interface SegmentTabProps {
  label: string;
  items: { id: string; label: React.ReactNode; count?: number }[];
  selected: string;
  onChange: (id: string) => void;
}

/** Big two-way switch (Photos / Videos). Single-select, keyboard arrows follow reading direction. */
export function SegmentTab({ label, items, selected, onChange }: SegmentTabProps) {
  return (
    <ToggleButtonGroup
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[selected]}
      onSelectionChange={(keys: Set<Key>) => { const k = [...keys][0]; if (k != null) onChange(String(k)); }}
      className={s.segment}
    >
      {items.map((it) => (
        <ToggleButton key={it.id} id={it.id} className={s.segmentItem}>
          <span>{it.label}</span>
          {it.count != null ? <span className={`${s.segmentCount} meta`}>{it.count}</span> : null}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
