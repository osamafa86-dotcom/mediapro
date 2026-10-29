'use client';
import { Switch } from '@/components/ui';
import s from './admin.module.css';

/** A settings row: title + hint, switch at the inline end; the whole row toggles (44px target). */
export function SwitchRow({ title, hint, isSelected, onChange, isDisabled, testId }: {
  title: string; hint?: string; isSelected: boolean; onChange?: (v: boolean) => void; isDisabled?: boolean; testId?: string;
}) {
  return (
    <Switch className={s.switchRow} isSelected={isSelected} onChange={onChange} isDisabled={isDisabled} data-testid={testId}>
      <span className={s.switchText}><strong>{title}</strong>{hint ? <span>{hint}</span> : null}</span>
    </Switch>
  );
}
