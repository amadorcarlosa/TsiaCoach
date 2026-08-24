'use client';

import styles from './agent-rig.module.css';
import {useState} from 'react'
import {ModelPicker, type ModelOption} from './model-picker';
import {Transcript, type Turn} from "./transcript";
import {SetupDialog} from "@/app/agent/setup-dialog";
 type RigPhase='setup'|'chatting'

export function AgentRig({models}:{models:ModelOption[]}) {
    const [phase, setPhase] = useState<RigPhase>('setup');
     const [model, setModel] = useState(models[0]?.value ?? '');
    
    const [instructions, setInstructions] = useState('');
    const [turns, setTurns] = useState<Turn[]>([]);
    const [prompt, setPrompt] = useState('');

    function send() {
        if (!prompt.trim()) return;
        setTurns((prev) => [
            ...prev,
            { kind: 'user', text: prompt },
            { kind: 'assistant', text: `(echo) ${prompt}`, model },
        ]);
        setPrompt('');
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
                    <button onClick={send}>Send</button>
                </>
            )}
        </div>
    );
}