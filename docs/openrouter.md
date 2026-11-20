# Use OpenRouter for the .NET agent

The API supports `AgentProvider=Foundry` (the existing default) or `OpenRouter`.
OpenRouter uses the OpenAI .NET chat-completions client inside Microsoft Agent
Framework. Both `/api/agent` and the coaching flow use the selected provider.
The Nuxt admin model picker reads the configured models from `/api/models`.

## Local setup

The Aspire AppHost owns these settings and the key. It declares them as parameters
and forwards them to the API, so set them once in the AppHost's user secrets with
`aspire secret set` (from the repository root). Never put the key in Nuxt config,
source control, or a chat message.

| AppHost parameter | API setting | Default |
| --- | --- | --- |
| `ai-enabled` | `AI:Enabled` | `true` |
| `agent-provider` | `AgentProvider` | `Foundry` |
| `openrouter-api-key` (secret) | `OpenRouter:ApiKey` | required |
| `openrouter-models` | `OpenRouter:Models` (comma-separated) | empty |
| `foundry-endpoint` | `endpoint` | empty |
| `foundry-resource` | `foundryResource` | empty |
| `azure-tenant-id` | `tenantId` | empty |

To use OpenRouter:

```powershell
aspire secret set "Parameters:agent-provider" "OpenRouter"
aspire secret set "Parameters:openrouter-api-key" "YOUR_OPENROUTER_KEY"
aspire secret set "Parameters:openrouter-models" "openai/gpt-5.4-mini"
aspire start
```

To run without AI calls or provider credentials:

```powershell
aspire secret set "Parameters:ai-enabled" "false"
```

With AI disabled, the API skips provider setup, returns an empty model list, and makes
agent, coaching, and decision requests return HTTP 503 with "AI is disabled".
Other API features remain available. The OpenRouter key parameter is still required
because Jev decisions use it.

Use a currently available chat model ID from OpenRouter's catalog. Coaching needs
JSON object output support. List more models separated by commas
(`openai/gpt-5.4-mini,anthropic/claude-sonnet-4.5`). Only listed models can be
requested, and the first one coaches. Restart Aspire (`aspire start`) after changing
parameters.

In OpenRouter mode, Azure endpoint, Foundry resource, and Azure authentication are
not required. The key is forwarded only to the API, not to Nuxt.

Values set in the API's own user secrets (`dotnet user-secrets --project TsiaCoach.WebApi`)
are overridden by the AppHost when running through Aspire. They only apply when the API
runs on its own, where `OpenRouter:Models:0`, `OpenRouter:Models:1`, … also work.

### Deployment

Aspire publish and deploy ask for the same parameters. For non-interactive deploys, set
them as environment variables on the `aspire deploy` process, for example
`Parameters__openrouter-api-key` and `Parameters__agent-provider`. `aspire secret set`
is for local development only.

## Verify

Open `/api/models` to confirm the configured IDs have vendor `openRouter`, then
send a turn from the admin chat. Exercise a probe answer or a step question to
verify the chosen model supports coaching's JSON response format. Existing C#
validation still resolves authored categories to messages and authorized routes.
Provider authentication errors map to 502, rate limits to 429, and an unlisted
model to 400. Requests incur charges on your OpenRouter account.

To switch back, set `Parameters:agent-provider` to `Foundry` and set
`Parameters:foundry-endpoint` and `Parameters:foundry-resource` (plus
`Parameters:azure-tenant-id` if needed). Remove any old `CoachingAgent:Model` override
that names a model the new provider doesn't list.

## Jev decisions

The playground's **Structured decision** mode calls Jev 1.13 through
`POST /api/decisions` on the WebApi, which forwards the state and a Choice question
to OpenRouter's `/api/alpha/decisions`. It uses the same `OpenRouter:ApiKey`, including
the Aspire secret already forwarded by AppHost. Restart Aspire after backend changes.

Jev does not need to be added to `OpenRouter:Models`; that list is for chat models.
Jev works alongside either Foundry or OpenRouter chat mode. Its inspector shows the
selected action, confidence, probability distribution, raw response, and exact
provider request. It does not generate coaching prose or execute board actions.
The existing student coaching/scaffold endpoints remain unchanged.

References: [OpenRouter quickstart](https://openrouter.ai/docs/quickstart) and
[Jev Decisions API](https://openrouter.ai/docs/guides/community/jev).
