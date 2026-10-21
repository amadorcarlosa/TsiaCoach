# Use OpenRouter for the .NET agent

The API supports `AgentProvider=Foundry` (the existing default) or `OpenRouter`.
OpenRouter uses the OpenAI .NET chat-completions client inside Microsoft Agent
Framework. Both `/api/agent` and the coaching flow use the selected provider.
The Nuxt admin model picker reads the configured models from `/api/models`.

## Local setup

From the repository root, store these settings in the WebApi's development user
secrets. Replace the key placeholder locally; never put the key in Nuxt config,
source control, or a chat message.

```powershell
dotnet user-secrets set "AgentProvider" "OpenRouter" --project TsiaCoach.WebApi
dotnet user-secrets set "OpenRouter:ApiKey" "YOUR_OPENROUTER_KEY" --project TsiaCoach.WebApi
dotnet user-secrets set "OpenRouter:Models:0" "openai/gpt-5.4-mini" --project TsiaCoach.WebApi
dotnet user-secrets set "CoachingAgent:Model" "openai/gpt-5.4-mini" --project TsiaCoach.WebApi
dotnet run --project TsiaCoach.WebApi
```

Use a currently available chat model ID from OpenRouter's catalog. Coaching needs
JSON object output support. Add additional models as `OpenRouter:Models:1`, etc.
Only listed models can be requested. If `CoachingAgent:Model` is absent, the first
listed model is used; remove or update an old Foundry coaching model setting.

In OpenRouter mode, Azure endpoint, Foundry resource, and Azure authentication are
not required. Restart the API after configuration changes.

### Running through Aspire

The AppHost declares a secret parameter named `openrouter-api-key` and forwards it
to the API as `OpenRouter__ApiKey`. Store the key in AppHost user secrets:

```powershell
dotnet user-secrets set "Parameters:openrouter-api-key" "YOUR_OPENROUTER_KEY" --project TsiaCoach.AppHost
```

For Aspire runs, use this AppHost secret instead of the WebApi key command above.
Keep the provider and model settings in WebApi user secrets as shown above; adding
the key alone does not switch the provider to OpenRouter. Restart Aspire after
changing AppHost wiring. The key is forwarded only to the API, not to Nuxt.

For deployed environments, use a secret store or environment variables:
`AgentProvider`, `OpenRouter__ApiKey`, `OpenRouter__Models__0`, and
`CoachingAgent__Model`. User secrets are loaded only in Development.

## Verify

Open `/api/models` to confirm the configured IDs have vendor `openRouter`, then
send a turn from the admin chat. Exercise a probe answer or a step question to
verify the chosen model supports coaching's JSON response format. Existing C#
validation still resolves authored categories to messages and authorized routes.
Provider authentication errors map to 502, rate limits to 429, and an unlisted
model to 400. Requests incur charges on your OpenRouter account.

To switch back, set `AgentProvider` to `Foundry`, restore a Foundry
`CoachingAgent:Model` (or remove that override), and supply the existing Azure
configuration.

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
