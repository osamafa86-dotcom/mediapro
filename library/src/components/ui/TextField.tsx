'use client';
import {
  TextField as RACTextField, Label, Input, Text, FieldError,
  Select as RACSelect, SelectValue, Button, Popover, ListBox, ListBoxItem,
  type TextFieldProps as RACTextFieldProps, type SelectProps as RACSelectProps, type Key,
} from 'react-aria-components';
import { ChevronDown } from 'lucide-react';
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
