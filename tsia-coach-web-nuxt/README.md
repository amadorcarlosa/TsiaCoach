# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Use Node 22 and the pnpm version declared in `package.json`. The tested runtime is
pinned to Node 22.13.1 in `.nvmrc` and `pnpm-workspace.yaml`. Run scripts through
pnpm so it selects that runtime automatically, even from a Node 24 shell. Aspire's
`WithPnpm()` launcher uses the same project configuration.

Check the selected runtime with `pnpm exec node --version`. When updating the
runtime pin, update both files together and rerun the tests.

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
