import {
    postAgentRequest,
    type AgentRequest,
} from '@/lib/api/agents';

/**
 * Handles POST requests for the `/api/agents` route.
 *
 * This handler parses the JSON body as `AgentRequest`, forwards it to the
 * shared backend client (`postAgentRequest`), and returns the agent response.
 *
 * Response mapping:
 * - `200` – request accepted and proxied response returned.
 * - `400` – invalid JSON body in the request.
 * - `502` – downstream agent execution failed.
 *
 * @param request - Incoming HTTP request carrying an `AgentRequest` payload.
 * @returns JSON response containing the proxied `AgentResponse`.
 */
export async function POST(request: Request): Promise<Response> {
    try {
        const body = (await request.json()) as AgentRequest;
        const response = await postAgentRequest(body);

        return Response.json(response);
    } catch (error) {
        if (error instanceof SyntaxError) {
            return Response.json(
                { error: 'Invalid JSON request body' },
                { status: 400 },
            );
        }

        return Response.json(
            { error: 'Could not run agent' },
            { status: 502 },
        );
    }
}
