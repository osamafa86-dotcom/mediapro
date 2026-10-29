'use client';
import { Button as RACButton, type ButtonProps as RACButtonProps } from 'react-aria-components';
import s from './ui.module.css';

export interface IconButtonProps extends Omit<RACButtonProps, 'children'> {
  /** Accessible name is mandatory — an icon is not a label. */
  'aria-label': string;
  variant?: 'ghost' | 'surface' | 'onMedia';
  size?: 32 | 44;
  children: React.ReactNode;
}

export function IconButton({ variant = 'ghost', size = 32, className, children, ...rest }: IconButtonProps) {
  return (
    <RACButton
      {...rest}
      className={[s.iconBtn, s[`iconBtn-${variant}`], size === 44 ? s['iconBtn-44'] : '', typeof className === 'string' ? className : ''].join(' ')}
    >
      <span aria-hidden="true" className={s.iconBtnGlyph}>{children}</span>
    </RACButton>
  );
}
