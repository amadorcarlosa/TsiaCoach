using TUnit.AspNetCore;

namespace TsiaCoach.WebApi.Tests;

public abstract class ApiTestBase
    : WebApplicationTest<ApiFactory, Program>;