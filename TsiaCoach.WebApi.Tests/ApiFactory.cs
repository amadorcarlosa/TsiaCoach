using Microsoft.Extensions.Configuration;
using TUnit.AspNetCore;

namespace TsiaCoach.WebApi.Tests;

public sealed class ApiFactory
    : TestWebApplicationFactory<Program>
{
    protected override void ConfigureStartupConfiguration(
        IConfigurationBuilder configuration)
    {
        configuration.AddInMemoryCollection(
            new Dictionary<string, string?>
            {
                ["endpoint"] = "https://example.invalid",
                ["foundryResource"] = "test-resource"
            });
    }
}