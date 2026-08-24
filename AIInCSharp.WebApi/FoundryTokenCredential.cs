using System.Net.Http.Headers;
using Anthropic.Foundry;
using Azure.Core;

namespace AIInCSharp.WebApi;

public sealed class FoundryTokenCredential : IAnthropicFoundryCredentials
{
    private sealed record CachedToken(string Value, DateTimeOffset ExpiresOn);
    private readonly TokenCredential _credential;
    private readonly TokenRequestContext _context;
    private readonly object _gate = new();
    private volatile CachedToken? _cache;
    public FoundryTokenCredential(
        TokenCredential tokenCredential,
        string resourceName,
        string[]? scopes = null)
    {
        _credential = tokenCredential ?? throw new ArgumentNullException(nameof(tokenCredential));
        ResourceName = resourceName ?? throw new ArgumentNullException(nameof(resourceName));
        _context = new TokenRequestContext(scopes ?? ["https://ai.azure.com/.default"]);
    }
    public string ResourceName { get; }
    public void Apply(HttpRequestMessage request)
    {
        var cached = _cache;
        if (IsStale(cached))
        {
            lock (_gate)
            {
                cached = _cache;
                if (IsStale(cached))
                {
                    AccessToken token = _credential.GetToken(_context, CancellationToken.None);
                    _cache = cached = new CachedToken(token.Token, token.ExpiresOn);
                }
            }
        }
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", cached!.Value);
    }
    private static bool IsStale(CachedToken? t) =>
        t is null || t.ExpiresOn <= DateTimeOffset.UtcNow.AddMinutes(5);
} 