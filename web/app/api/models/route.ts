// app/api/models/route.ts
import { getModels } from "@/lib/api/models";

export async function GET(): Promise<Response> {
    try {
        return Response.json(await getModels());
    } catch (err) {
        return Response.json(
            {
                error: 'Could not load models from the ASP.NET API',
                details: err instanceof Error ? err.message : String(err),
            },
            { status: 502 },
        );
    }
}