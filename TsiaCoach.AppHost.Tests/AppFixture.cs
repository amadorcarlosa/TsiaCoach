namespace TsiaCoach.AppHost.Tests;

using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;
using Aspire.Hosting.Testing;
using TUnit.Aspire;



public sealed class AppFixture
    : AspireFixture<Projects.TsiaCoach_AppHost>
{
    protected override TimeSpan ResourceTimeout =>
        TimeSpan.FromMinutes(2);

    protected override IEnumerable<string>
        ResourcesToRemove() =>
        ["web-nuxt"];

    protected override void ConfigureBuilder(
        IDistributedApplicationTestingBuilder builder)
    {
        builder.CreateResourceBuilder<ProjectResource>("api")
            .WithEnvironment(
                "endpoint",
                "https://example.invalid")
            .WithEnvironment(
                "foundryResource",
                "test-resource");
    }
}