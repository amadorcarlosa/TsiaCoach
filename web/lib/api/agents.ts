
import 'server-only';
import type { components } from '@/lib/api/schema';

/**
 * Request body for agent execution.
 *
 * This type mirrors `AgentRequest` from the generated OpenAPI schema.
 *
 * @see AIInCSharp.WebApi.EndPoints.AgentEndpoints.MapAgents
 */
export type AgentRequest =
    components['schemas']['AgentRequest'];

/**
 * Response body returned by the agent endpoint.
 *
 * This type mirrors `AgentResponse` from the generated OpenAPI schema.
 *
 * @see AIInCSharp.WebApi.EndPoints.AgentEndpoints.MapAgents
 */
export type AgentResponse =
    components['schemas']['AgentResponse'];

const apiUrl = process.env.API_URL;

if (!apiUrl) {
    throw new Error(
        'API_URL is not set. Run through Aspire, or set API_URL manually.',
    );
}

/**
 * Executes the backend agent endpoint.
 *
 * Calls `POST /api/agent` to trigger `MapAgents` and returns a resolved
 * `AgentResponse`.
 *
 * Backend mapping:
 * `AIInCSharp.WebApi.EndPoints.AgentEndpoints.MapAgents`
 * Route: `POST /api/agent`
 *
 * @param agentRequest - Structured request payload sent to the agent endpoint.
 * @returns A promise resolving to the parsed `AgentResponse`.
 * @throws {Error} If the network request fails or response status is not OK.
 */
export async function postAgentRequest(
    agentRequest: AgentRequest,
): Promise<AgentResponse> {
    const response = await fetch(`${apiUrl}/api/agent`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(agentRequest),
    });

    if (!response.ok) {
        const details = await response.text();
        throw new Error(
            `Agent request failed (${response.status}): ${details}`,
        );
    }

    return (await response.json()) as AgentResponse;
} 
