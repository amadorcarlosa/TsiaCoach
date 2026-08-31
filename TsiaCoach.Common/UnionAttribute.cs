namespace TsiaCoach.Common;


    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Struct, AllowMultiple = false)]
    public sealed class UnionAttribute : Attribute;

    public interface IUnion
    {
        object? Value { get; }
    }
