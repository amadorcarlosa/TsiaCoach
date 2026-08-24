namespace AIInCSharp.WebApi.Agents;
using static Models;

public static class ModelExtension
{
    public static string PromptForModel()
    {
        while (true)
        {
            Output.Green("Select model:");
            for (int i = 0; i < AvailableModels.Length; i++)
                Console.WriteLine($" {i + 1}: {AvailableModels[i]}");

            Console.Write("Choice: ");
            string? choice = Console.ReadLine();

            if (choice is null)
            {
                return AvailableModels[0];
            }

            if (string.IsNullOrWhiteSpace(choice))
            {
                Output.Green($"No choice made, using {AvailableModels[0]}");
                return AvailableModels[0];
            }

            if (int.TryParse(choice, out int n) && n >= 1 && n <= AvailableModels.Length)
            {
                return AvailableModels[n - 1];
            }

            Output.Red($"'{choice}' is not on the list. Pick 1-{AvailableModels.Length}.");
        }
    }
}