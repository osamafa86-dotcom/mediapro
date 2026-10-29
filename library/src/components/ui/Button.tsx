'use client';
import { Button as RACButton, type ButtonProps as RACButtonProps } from 'react-aria-components';
import s from './ui.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends RACButtonProps {
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  icon?: React.ReactNode;
}

/** One Primary per view (DESIGN.md). Icons sit at the inline start and flip only if they are on the mirror allow-list. */
export function Button({ variant = 'secondary', size = 'md', icon, className, children, ...rest }: ButtonProps) {
  return (
    <RACButton
      {...rest}
      className={[s.btn, s[`btn-${variant}`], size === 'lg' ? s['btn-lg'] : '', typeof className === 'string' ? className : ''].join(' ')}
    >
      {(render) => (
        <>
          {icon ? <span className={s.btnIcon} aria-hidden="true">{icon}</span> : null}
          {typeof children === 'function' ? children(render) : children}
        </>
      )}
    </RACButton>
  );
}
