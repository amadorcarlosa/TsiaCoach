// lib/api/models.ts
import type { components } from '@/lib/api/schema';

type FoundryDeploymentResponse =
    components['schemas']['FoundryDeploymentResponse'];

export async function getModels(): Promise<FoundryDeploymentResponse[]> {
    const apiUrl = process.env.API_URL;
    if (!apiUrl) throw new Error('API_URL is not configured.');

    const res = await fetch(`${apiUrl}/api/models`);
    if (!res.ok) throw new Error(`GET /api/models failed: ${res.status}`);

    return res.json();
}