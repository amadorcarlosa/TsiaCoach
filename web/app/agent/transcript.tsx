// app/agent/transcript.tsx

import type { components } from '@/lib/api/schema';

/**
 * Wire-level message shape used by the agent API request payload.
 */
export type TurnDto = components['schemas']['TurnDto'];

/**
 * A single user turn in the visible conversation transcript.
 */
export type UserTurn = { kind: 'user'; text: string };

/**
 * A single assistant turn in the visible conversation transcript.
 */
export type AssistantTurn = { kind: 'assistant'; text: string; model: string };

/**
 * Conversation turn union used by the chat transcript UI.
 */
export type Turn = UserTurn | AssistantTurn;

/**
 * Maps a UI `Turn` into the API wire format (`TurnDto`).
 *
 * @param turn - UI turn to serialize for request payloads.
 * @returns The wire transfer representation expected by the backend.
 */
export function toWire(turn: Turn): TurnDto {
    if (turn.kind === 'assistant') {
        return { role: 'assistant', model: turn.model, message: turn.text };
    }

    return { role: 'user', message: turn.text };
}

export type TranscriptProps = {
    /** Ordered turns to render in the transcript. */
    turns: Turn[];
};

/**
 * Renders a transcript of user and assistant turns.
 *
 * @param props - Component props.
 * @param props.turns - Ordered turns to render.
 * @returns An ordered list of transcript entries.
 */
export function Transcript({ turns }: TranscriptProps) {
    return (
        <ol>
            {turns.map((t, i) => (
                <li key={i}>
                    {t.kind === 'user' ? 'You' : t.model}: {t.text}
                </li>
            ))}
        </ol>
    );
}
