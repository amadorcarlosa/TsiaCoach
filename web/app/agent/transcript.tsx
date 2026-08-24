// app/agent/transcript.tsx
export type Turn =
    | { kind: 'user'; text: string }
    | { kind: 'assistant'; text: string; model: string };
export function Transcript({ turns }: { turns: Turn[] }) {
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