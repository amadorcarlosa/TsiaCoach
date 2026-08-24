// gen-api.mjs: Generate TypeScript types from the API's OpenAPI contract
// Run: pnpm gen-api  
import {execSync} from 'node:child_process';

const apiUrl  = process.env.API_URL;
if (!apiUrl) {
    console.error('API_URL is not set.');
    process.exit(1);
}
execSync(
    `pnpm exec openapi-typescript ${apiUrl}/openapi/v1.json -o lib/api/schema.d.ts`,
    { stdio: 'inherit' },
);