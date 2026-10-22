# Bird Alert!

[**bird-alert.vercel.app**](https://bird-alert.vercel.app/) · API lives in [bird-alert-be](https://github.com/mbenfowler/bird-alert-be)

I'm a casual backyard birder, and I wanted something simpler than eBird's firehose: tell me which birds are around *my* county, let me keep a short list of the ones I care about, and ping me when one of them turns up nearby. That's Bird Alert.

<div align="center">
  <img height="300px" src="public/images/bird-alert-mobile.gif" alt="the app on a phone">
  &nbsp;&nbsp;
  <img height="300px" src="public/images/bird-alert-desktop.gif" alt="the app on a desktop">
</div>

## What it does

- **Birds in your area.** Pick your state and county in settings and the home page lists every species eBird has recorded there, five at a time, with a photo, the scientific name, and a link to Wikipedia.
- **Watch list.** Tick a bird to watch it. Your saved birds get their own page, each showing when it was last reported near you.
- **Alerts.** The panel at the top of the home page shows recent sightings of your watch-list birds, and a second tab shows eBird's "notable" sightings for the area. Each one links to the spot on a map.
- **Arriving soon.** A third tab lists the species that were around your county this time last year but haven't been reported yet, judged from a year of eBird's daily reports, with a one-tap watch toggle and a link to the night's BirdCast radar for the county. Each sighting page shows which months of the year the species is around.
- **Push notifications.** Turn them on per device and choose watch-list sightings, notable sightings, the first report of a returning migrant each season, or all three, with quiet hours in your own time zone. Watch-list birds arrive together once an hour; tapping opens a page with every one of them pinned on a map and listed beneath. Notable and first-of-season birds get their own notification with a map button.
- **Email digests.** Opt in to a daily email when one of your birds was seen yesterday, a separate one for uncommon sightings, and a Sunday migration summary: who arrived this week, who moved on, and who to expect next. Every email has a one-click unsubscribe.
- **Search.** Look up any bird by name, even ones that aren't local.

## How it's built

The front end is React with TypeScript, built by Vite. Server state goes through TanStack Query: the species list for your county and the bird records are cached in the browser for days, so a revisit draws from cache before the network answers, and flipping pages is free. Bird records are assembled once on the server from eBird taxonomy plus a photo from [Nuthatch](https://nuthatch.lastelm.software) or Wikipedia, then stored, so a bird is only ever looked up once for everyone.

The API is a handful of Vercel serverless functions over Postgres, in the [bird-alert-be](https://github.com/mbenfowler/bird-alert-be) repo. Sessions are cookies, passwords are bcrypt, and the links in emails are signed tokens that expire. All eBird traffic goes through the API so no keys live in the browser. Two daily crons send the digests. Everything runs on free tiers.

This started as my final project at Turing School in 2023. In 2026 I rebuilt most of it: auth, the build tooling, the data layer, and the backend, with tests around each piece. The git history has the details if you're curious.

## Running it locally

You need Node 22, Postgres, and the API running next door.

```bash
# API, in bird-alert-be (see its README for the .env it needs)
npm install && npm run migrate && npm run dev        # http://localhost:3001

# this repo
npm install
npm start                                            # http://localhost:3000, proxies /api to 3001
```

No `.env` is needed here; the API holds all the keys.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Dev server with hot reload |
| `npm run build` | Type-check, then build to `dist/` |
| `npm run lint` / `npm run typecheck` | ESLint and `tsc` |
| `npm test` | Vitest unit tests (`npm run test:watch` while developing) |
| `npm run test:e2e` | Cypress, headless. Needs the dev server up; every network call is stubbed, so the API isn't required |

Cypress also runs [axe](https://github.com/dequelabs/axe-core) on each main view and fails the build on serious accessibility problems. CircleCI runs lint, type-check, unit tests, the build, and the Cypress suite on every pull request.

## Deploying

Pushes to `main` deploy to Vercel automatically. `vercel.json` rewrites `/api/*` to the API's domain so the session cookie stays first-party.

## Thanks

Bird data is from the [eBird API](https://documenter.getpostman.com/view/664302/S1ENwy59), photos from Nuthatch and Wikimedia Commons, and most of the goose photos exist because Georgia has a lot of geese.
