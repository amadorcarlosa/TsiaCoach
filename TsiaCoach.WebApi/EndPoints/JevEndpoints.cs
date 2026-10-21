using System.Text.Json;
using TsiaCoach.WebApi.Agents;

namespace TsiaCoach.WebApi.EndPoints;

public static class JevEndpoints
{
    public static RouteGroupBuilder MapJev(this RouteGroupBuilder group)
    {
        group.MapPost("/decisions", async (JevRequest input, JevDecisionClient client, CancellationToken token) =>
        {
            if (input.State.ValueKind != JsonValueKind.Object || input.State.GetRawText().Length > 100_000 ||
                string.IsNullOrWhiteSpace(input.Instructions) || input.Instructions.Length > 10_000)
                return Results.Problem(statusCode: 400, title: "Provide a board state and decision instructions within the size limits.");
            try { return Results.Ok(await client.DecideAsync(input, token)); }
            catch (JevConfigurationException) { return Results.Problem(statusCode: 503, title: "Jev requires the OpenRouter API key. Configure the Aspire secret and restart."); }
            catch (HttpRequestException error) { return Results.Problem(statusCode: error.StatusCode == System.Net.HttpStatusCode.TooManyRequests ? 429 : 502, title: "OpenRouter could not complete the Jev decision."); }
            catch (OperationCanceledException) { return Results.Problem(statusCode: token.IsCancellationRequested ? 499 : 504, title: "Jev request cancelled or timed out."); }
            catch (Exception error) when (error is JsonException or KeyNotFoundException or FormatException or InvalidOperationException) { return Results.Problem(statusCode: 502, title: "Jev returned an invalid decision response."); }
        }).WithName("RunJevDecision").WithTags("Decisions");
        return group;
    }
}
