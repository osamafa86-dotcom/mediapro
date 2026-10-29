'use client';
import { Switch as RACSwitch, type SwitchProps as RACSwitchProps } from 'react-aria-components';
import s from './ui.module.css';

/** On = knob at the end of the line; the whole row is the 44px touch target (DESIGN.md). */
export function Switch({ children, className, ...rest }: RACSwitchProps & { children: React.ReactNode }) {
  return (
    <RACSwitch {...rest} className={[s.switch, typeof className === 'string' ? className : ''].join(' ')}>
      <span className={s.switchLabel}>{children}</span>
      <span className={s.switchTrack} aria-hidden="true"><span className={s.switchKnob} /></span>
    </RACSwitch>
  );
}
