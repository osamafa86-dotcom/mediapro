'use client';
import {
  TextField as RACTextField, Label, Input, Text, FieldError, ComboBox, Group,
  Select as RACSelect, SelectValue, Button, Popover, ListBox, ListBoxItem,
  type TextFieldProps as RACTextFieldProps, type SelectProps as RACSelectProps, type Key,
} from 'react-aria-components';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import s from './ui.module.css';

export interface TextFieldProps extends RACTextFieldProps {
  label: string;
  description?: string;
  /** Says what the user should do to fix it, not just that it is wrong. */
  errorMessage?: string;
  placeholder?: string;
}

export function TextField({ label, description, errorMessage, placeholder, className, ...rest }: TextFieldProps) {
  return (
    <RACTextField {...rest} isInvalid={rest.isInvalid ?? !!errorMessage} className={[s.field, typeof className === 'string' ? className : ''].join(' ')}>
      <Label className={s.fieldLabel}>{label}</Label>
      <Input className={s.input} placeholder={placeholder} />
      {description && !errorMessage ? <Text slot="description" className={s.fieldHelp}>{description}</Text> : null}
      <FieldError className={s.fieldError}>{errorMessage}</FieldError>
    </RACTextField>
  );
}

export interface SelectFieldProps<T extends object> extends Omit<RACSelectProps<T>, 'children'> {
  label: string;
  items: { id: string; label: string }[];
  description?: string;
  value?: string;
  onValueChange?: (id: string) => void;
}

export function SelectField<T extends object>({ label, items, description, value, onValueChange, className, ...rest }: SelectFieldProps<T>) {
  return (
    <RACSelect
      {...rest}
      selectedKey={value}
      onSelectionChange={(k: Key | null) => { if (k != null) onValueChange?.(String(k)); }}
      className={[s.field, typeof className === 'string' ? className : ''].join(' ')}
    >
      <Label className={s.fieldLabel}>{label}</Label>
      <Button className={`${s.input} ${s.selectTrigger}`}>
        <SelectValue />
        <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
      </Button>
      {description ? <Text slot="description" className={s.fieldHelp}>{description}</Text> : null}
      <Popover className={s.popover}>
        <ListBox className={s.listbox}>
          {items.map((it) => (
            <ListBoxItem key={it.id} id={it.id} className={s.option}>{it.label}</ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </RACSelect>
  );
}

export interface ComboFieldProps {
  label: string;
  description?: string;
  /** saved choices, offered as the user types; any other text is accepted too (and saved by the server) */
  options: string[];
  value: string;
  onChange: (v: string) => void;
  isRequired?: boolean;
  autoFocus?: boolean;
  /** matching that ignores what should not matter (hamza forms, taa marbuta, harakat…) */
  normalize?: (s: string) => string;
  emptyLabel?: string;
  testId?: string;
}

/** A text field with a list under it: pick a saved name, or type a new one. */
export function ComboField({ label, description, options, value, onChange, isRequired, autoFocus, normalize = (x) => x.toLowerCase(), emptyLabel, testId }: ComboFieldProps) {
  // the arrow shows every saved choice; typing narrows the list
  const [all, setAll] = useState(false);
  const q = all ? '' : normalize(value.trim());
  const shown = options.filter((o) => !q || normalize(o).includes(q)).slice(0, 50);
  return (
    <ComboBox
      className={s.field} allowsCustomValue allowsEmptyCollection menuTrigger="input" isRequired={isRequired} autoFocus={autoFocus}
      inputValue={value} onInputChange={(v) => { setAll(false); onChange(v); }}
      onOpenChange={(open, trigger) => setAll(open && trigger === 'manual')}
      onSelectionChange={(k: Key | null) => { if (k != null) onChange(String(k)); }}
      items={shown.map((o) => ({ id: o }))} data-testid={testId}
    >
      <Label className={s.fieldLabel}>{label}</Label>
      <Group className={s.comboGroup}>
        <Input className={s.input} />
        {options.length ? <Button className={s.comboBtn}><ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" /></Button> : null}
      </Group>
      {description ? <Text slot="description" className={s.fieldHelp}>{description}</Text> : null}
      <Popover className={s.popover}>
        <ListBox className={s.listbox} renderEmptyState={() => (emptyLabel ? <div className={s.comboEmpty}>{emptyLabel}</div> : null)}>
          {(it: { id: string }) => <ListBoxItem id={it.id} textValue={it.id} className={s.option}>{it.id}</ListBoxItem>}
        </ListBox>
      </Popover>
    </ComboBox>
  );
}
