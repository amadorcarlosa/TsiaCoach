namespace AIInCSharp.WebApi.Agents;
using System.Text.Json.Serialization;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum VendorName
{
   Anthropic,
   OpenAI,
   DeepSeek
}
public static class Models
{
   public static string[] AvailableModels =>
   [
      Gpt.Model.Five.Version.Four.Type.Mini.Name,
      Gpt.Model.Five.Chat.Name,
      Gpt.Model.Five.Version.Six.Type.Sol.Name,
      Gpt.Model.Five.Nano.Name,
      DeepSeek.Model.Version.Four.Type.Pro.Name,
      Claude.Model.Opus.Version.Five.Name
   ];

   public static class Gpt
   {
      public static readonly VendorName Vendor = VendorName.OpenAI;
      public static class Model
      {
         public static class Five
         {
            public static class Chat
            {
               public const string Name = "gpt-5-chat";
               public const string View = "GPT 5 Chat";
            }

            public static class Nano
            {
               public const string Name = "gpt-5-nano";
               public const string View = "GPT 5 Nano";
            }

            public static class Version
            {
               public static class Four
               {
                  public static class Type
                  {
                     public static class Mini
                     {
                        public const string Name = "gpt-5.4-mini";
                        public const  string View = "GPT 5.4 Mini";
                     }
                  }
               }

               public static class Six
               {
                  public static class Type
                  {
                     public static class Sol
                     {
                        public const string Name = "gpt-5.6-sol";
                        public const string View = "GPT 5.6 Sol";
                     }
                  }
               }
            }
         }
      }
   }

   public static class DeepSeek
   {
      public static VendorName Vendor = VendorName.DeepSeek;
      public static class Model
      {
         public static class Version
         {
            public static class Four
            {
               public static class Type
               {
                  public static class Pro
                  {
                     public const string Name = "DeepSeek-V4-Pro";
                     public const string View = "DeepSeek V4 Pro";
                  }
               }
            }
         }
      }
   }

   public static class Claude
   {
      public  static VendorName Vendor = VendorName.Anthropic;
      public static class Model
      {
         public static class Opus
         {
            public static class Version
            {
               public static class Five
               {
                  public const string Name = "claude-opus-5";
                  public const string View = "Claude Opus 5";
               }
            }
         }
      }
   }
   

}

