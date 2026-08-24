

export async function GET():Promise<Response>{
    const apiUrl:string |undefined=process.env.API_URL
    if(!apiUrl){
        return new Response(
            "API_URL environment variable is not set",{status:500});
    }
    try{
        const response = await fetch(`${apiUrl}/health`,
            {
                cache: "no-store",
            });
        const data = await response.text();
        return Response.json
        ({
            status:data,
            apiStatus: response.status,
        },
            {
                status:response.ok ? 200 : response.status,
            }
            );
        
        
       }
    catch(err){
        return Response.json(
            {
                error: "Next.Js could not reach the ASP.NET API",
                details: err instanceof Error ? err.message : String(err)
            },
            {status:502}
        )
    }
    
    
    
    
}