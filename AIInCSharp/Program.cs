using Azure;
using Azure.AI.OpenAI;
using Azure.Core;
using Azure.Identity;
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Configuration;
using OpenAI.Chat;
using System;

Console.WriteLine("Hello, World!");
IConfigurationRoot configuration = new ConfigurationBuilder().AddUserSecrets<Program>().Build();
const string modelName = "gpt-5.4-mini";
string? endpoint = configuration["endpoint"];
if(string.IsNullOrEmpty(endpoint))
{
    throw new InvalidOperationException("Endpoint is not configured.");
}

TokenCredential credential = new ChainedTokenCredential(
    new AzureCliCredential(),
    new InteractiveBrowserCredential(),   // fallback for local interactive
    new EnvironmentCredential()           // fallback for CI with env vars
);

AzureOpenAIClient client = new AzureOpenAIClient(new Uri(endpoint), credential);

ChatClientAgent agent = client.GetChatClient(modelName).AsAIAgent();

try
{
    var response = await agent.RunAsync("Who is better LLM researcher between Ilya Sutskever and Dario Amodei? and why provide reasons and rubric?");

    Console.WriteLine(response);
}
catch (RequestFailedException ex)
{
    Console.WriteLine($"Request failed: {ex.Message}");
}