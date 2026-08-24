// page.tsx
import { getModels } from '@/lib/api/models';
// page.tsx

import { AgentRig } from './agent-rig';
import type { ModelOption } from './model-picker';

export default async function AgentPage() {
    const deployments = await getModels();

    const models: ModelOption[] = 
        deployments.map
        ((d) => 
            ({
                value: d.name, 
                label: d.displayName,
                vendor: d.vendor,
            }));

    return <AgentRig models={models}/>
};