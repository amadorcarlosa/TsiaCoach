// app/agent/setup-dialog.tsx
'use client';

import { AlertDialog } from '@base-ui/react/alert-dialog';
import styles from './setup-dialog.module.css';

type SetupDialogProps = {
    open: boolean;
    instructions: string;
    onInstructionsChange: (value: string) => void;
    onStart: () => void;
};

export function SetupDialog({ open, instructions, onInstructionsChange, onStart }: SetupDialogProps) {
    const canStart = instructions.trim().length > 0;

    return (
        <AlertDialog.Root open={open}>
            <AlertDialog.Portal>
                <AlertDialog.Backdrop className={styles.backdrop} />
                <AlertDialog.Popup className={styles.popup}>
                    <AlertDialog.Title className={styles.title}>New thread</AlertDialog.Title>
                    <AlertDialog.Description className={styles.description}>
                        Set the agent's instructions for this thread. You can change them later in settings.
                    </AlertDialog.Description>

                    <textarea
                        className={styles.textarea}
                        value={instructions}
                        onChange={(e) => onInstructionsChange(e.target.value)}
                        placeholder="Enter instructions"
                        rows={5}
                    />

                    <button className={styles.start} onClick={onStart} disabled={!canStart}>
                        Start
                    </button>
                </AlertDialog.Popup>
            </AlertDialog.Portal>
        </AlertDialog.Root>
    );
}