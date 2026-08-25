'use client';

import styles from './agent-rig.module.css';
import {useState} from 'react'
import {ModelPicker, type ModelOption} from './model-picker';
import {Transcript, toWire, type Turn} from "./transcript";
import {SetupDialog} from "@/app/agent/setup-dialog";

/**
 * Supported workflow states for the agent rig.
 *
 * - `setup`: The configuration/setup dialog is open.
 * - `chatting`: The chat interface is active.
 */
type RigPhase='setup'|'chatting'

/**
 * Props for the {@link AgentRig} component.
 *
 * @property models - Available model options shown in the picker.
 */
export type AgentRigProps = {
    models: ModelOption[];
}

/**
 * Renders the agent interaction workflow.
 *
 * The component starts in setup mode, then transitions to chatting mode. In
 * chat mode it sends prompt requests to `/api/agent` and renders the transcript.
 *
 * @param props - Agent rig props.
 * @param props.models - Available model options.
 * @returns The rendered agent rig UI.
 */
export function AgentRig({ models }: AgentRigProps) {
    const [phase, setPhase] = useState<RigPhase>('setup');
    const [model, setModel] = useState(models[0]?.value ?? '');
    const [instructions, setInstructions] = useState('');
    const [turns, setTurns] = useState<Turn[]>([]);
    const [prompt, setPrompt] = useState('');
    const [isSending, setIsSending] = useState(false);

    /**
     * Sends the current prompt to the agent API and appends both turns.
     *
     * Request payload:
     * - `model`: selected model identifier
     * - `instructions`: setup instructions
     * - `prompt`: user message
     * - `history`: current transcript mapped with {@link toWire}
     *
     * @returns Promise resolving when UI state is synchronized with the response.
     */
    async function send() {
        if (isSending || !prompt.trim()) return;
        setIsSending(true);
        try {
            const userTurn: Turn = { kind: 'user', text: prompt };
            const result = await fetch('/api/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    instructions,
                    prompt,
                    history: turns.map(toWire),   // Turn → TurnDto, the seam mapping
                }),
            }).then((r) => r.json());

            setTurns((prev) => [
                ...prev,
                userTurn,
                { kind: 'assistant', text: result.text, model: result.model },
            ]);
            setPrompt('');
        } finally {
            setIsSending(false);
        }
    }

    return (
        <div>
            {/* UNCHANGED: the gate stays, always rendered, open only during setup */}
            <SetupDialog
                open={phase === 'setup'}
                instructions={instructions}
                onInstructionsChange={setInstructions}
                onStart={() => setPhase('chatting')}
            />

            {/* THE EDIT: only this branch's contents change */}
            {phase === 'chatting' && (
                <>
                    <ModelPicker models={models} value={model} onValueChange={setModel} />
                    <Transcript turns={turns} />
                    <input
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Enter prompt"
                    />
                    <button onClick={send} disabled={isSending}>Send</button>
                </>
            )}
        </div>
    );
}
