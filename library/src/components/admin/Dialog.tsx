'use client';
import { X } from 'lucide-react';
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { IconButton } from '@/components/ui';
import s from './admin.module.css';

/** One modal for the admin panel: focus trapped, Esc closes, scrim click closes, title is the accessible name. */
export function AdminDialog({ open, onOpenChange, title, subtitle, closeLabel, children, testId }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string; subtitle?: string; closeLabel: string; children: React.ReactNode; testId?: string;
}) {
  return (
    <ModalOverlay isOpen={open} onOpenChange={onOpenChange} isDismissable className={s.overlay}>
      <Modal>
        <Dialog className={s.dialog} data-testid={testId}>
          <div className={s.dialogHead}>
            <div>
              <Heading slot="title">{title}</Heading>
              {subtitle ? <p className={`${s.small} ${s.muted}`} style={{ margin: 0 }}>{subtitle}</p> : null}
            </div>
            <IconButton aria-label={closeLabel} onPress={() => onOpenChange(false)}><X size={18} /></IconButton>
          </div>
          {children}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
