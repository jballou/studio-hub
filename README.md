# Brand Creative Hub

Internal app where the Jira ticket (MKTGCRTV) is the spine: brief, assets/versions, review comments.
See the handover doc for scope. Stack: Next.js (App Router), TypeScript, Tailwind, Drizzle/Postgres (not wired yet).

## Dev

```bash
npm install
npm run dev -- -p 3100
```

- `/projects` list + calendar, `/projects/new` brief form
- `/review` assets, `/review/[assetId]` review canvas (image, PDF, video)

## Mock data layer

All UI talks to `lib/data/*` interfaces (`ReviewRepo`, `ProjectsRepo`). Mock adapters hold state in memory
(resets on reload). Swap in the Drizzle/Jira adapters in `lib/data/index.ts` on Days 3-6.
Schema draft: `lib/db/schema.ts`.

## Notes

- Sample video is not bundled: use "Load local video" in the review header, or add `public/samples/teaser.mp4`.
- Put the two Superside reference screenshots in `docs/reference/`.
