# Big Day dry run: audit (2026-11-03)

This audit is for event 2 (Cochise County, AZ, Nov 10): 3–4 members, canyons with weak or no signal. I only reported problems and fixed nothing.

## How it was run

- **Front end:** the production build of `origin/main` at 70bff34 (`npm run build` then `vite preview` on :3000). It ran in Playwright WebKit and Chromium (Playwright's bundled headless shell) at 390×844, with each member in a separate browser context.
- **Backend: not run.** The harness blocked creating the `bird-alert-be` worktree (`git -C ~/Github/bird-alert-be worktree add …`), so I used the stub approach instead. A stateful fake API shared by all the contexts stood in for the backend. I modelled it line by line on `lib/events.js` (`addTally`, `removeTally`, `viewEvent`, `listEvents`' `active` and `past` by account time zone), read from the newest local backend checkout (`.claude/worktrees/notable-skip-seen`). Because it is a stub, nothing touched any database, no mail was sent and nothing touched production. The only exception was a `curl -I` of the public site to read its cache headers.
- **Scenario:** a Big Day dated today with 4 members (Phoenix, Los Angeles and New York account time zones, plus a joiner with no time zone yet), 40 targets, a saved group route (a meeting point and 5 stops with stays) and scouting reports. The test identities and tokens are in a local seed file outside the repo; there are no passwords.
- **Test harness caveat:** with Playwright driving the installed Google Chrome (`channel: 'chrome'`), every route stayed on "Loading…" with no requests pending. The bundled Chromium and WebKit both rendered normally. I put this down to the harness and Chrome versions, not the app, but someone should open the app once in desktop Chrome to be sure.

## Field-breaking

### 1. Opening the app with no signal shows the browser's "not connected" page
- **Steps:** load `/events/2` with signal, kill the app (or have iOS evict it), then open it from the Home Screen in a canyon. Reloading the page or pulling to refresh does the same.
- **Seen:** Chromium returned `net::ERR_INTERNET_DISCONNECTED` even with the service worker installed and controlling the page. Playwright WebKit's reload failed ("internal error").
- **Why:** `public/sw.js` has no `fetch` handler, so nothing is cached for offline use. Vercel serves `index.html` **and** the hashed `/assets/*` chunks with `cache-control: public, max-age=0, must-revalidate`, so the HTTP cache can't stand in for the network either.
- **Files:** `public/sw.js`, `vercel.json`, `src/main.tsx`
- **Fix:** precache the app shell and its chunks in the service worker (serve the shell network-first, falling back to cache), and send `Cache-Control: public, max-age=31536000, immutable` for `/assets/*`.

### 2. Even with the app open, the event and tally aren't kept for offline use
- **Steps:** with the app open, go offline and reload, or come back after iOS has discarded the tab.
- **Seen:** the persisted cache (`bird-alert-query-cache`, 40 KB) held only `regions`, `birds` and `species-list`. The `events` query (event, targets, tally, members) isn't persisted, and neither are scouting or the route plan.
- **Files:** `src/hooks/queries.ts` (`useEventsQuery`, `useEventScoutingQuery`, `useEventRouteQuery`, `useEventRoutePlanQuery` have no `meta: { persist: true }`), `src/queryClient.ts` (`shouldDehydrateQuery` also drops stale queries, and `events` is stale at once on the tally page because `staleTime: 0`)
- **Fix:** persist `events`, `event-route-plan`, `event-route` and `event-scouting`, and let the dehydrate rule keep stale data for these keys so the last copy shows offline.

### 3. A tally entry added offline is lost if the app reloads or is killed before signal returns
- **Steps:** go offline, tap "+ Hepatic Tanager", reload (or let iOS kill the app), then reconnect and open the tally.
- **Seen (Chromium):** the paused mutation *was* written to localStorage (`mutations: 1`), but after the reload it never reached the server and the bird was gone.
- **Why:** `useEventTallyMutation` has no `mutationKey` and no `queryClient.setMutationDefaults`, so a restored mutation has no function to run, and nothing calls `resumePausedMutations()` after the cache is restored.
- **Files:** `src/hooks/mutations.ts` (`useEventTallyMutation`), `src/main.tsx` (`PersistQueryClientProvider` has no `onSuccess`)
- **Fix:** give the tally mutation a key and `setMutationDefaults({ mutationKey: ['event-tally'], mutationFn })`, and pass `onSuccess={() => queryClient.resumePausedMutations()}` to the provider.

### 4. A failed session check on weak signal signs the member out and leaves them on the login page
- **Steps:** open `/events/2/tally` when `/api/auth/me` fails at the network level. One bar does this: the page loads but the API call doesn't. It also happens when the app comes back to the foreground after 15+ minutes and the re-check fails.
- **Seen (both engines):** the app redirected to `/login?next=/events/2/tally` and stayed on "Log in or sign up" after the network came back. WebKit then showed "This page could not be loaded".
- **Why:** `App.tsx` treats any session error as logged out (`user = session.isError ? null : session.data`), and `useSessionQuery` has `retry: false` and `refetchOnWindowFocus: true`.
- **Files:** `src/components/App/App.tsx`, `src/hooks/queries.ts` (`useSessionQuery`)
- **Fix:** treat only a 401 as logged out. On network errors, keep the last user (persist the session query), retry, and show an "offline" note instead of redirecting.

### 5. Tapping into a page whose code hasn't loaded yet, while offline, ends on the browser's offline page
- **Steps:** open `/events/2` with signal (the tally page's code hasn't loaded yet), go offline, then tap **Open tally**.
- **Seen:** in Chromium, `lazyWithReload` catches the chunk failure and calls `location.reload()`, which leaves the member on `chrome-error://chromewebdata/`. In WebKit the URL changed to `/tally` but the event page stayed on screen, so the tap looked dead.
- **Files:** `src/lazyRetry.ts`, `src/components/App/App.tsx` (every route is lazy)
- **Fix:** skip the reload when `!navigator.onLine` or the import failed with a network error. Show the `RouteError` view instead, and prefetch the Events, EventDetail and EventTally chunks once an event is active (or precache them, see #1).

### 6. Members whose account time zone isn't Arizona lose the day early
- **Steps:** an account with time zone `America/New_York` opens the event at 10:30 pm Arizona time on Nov 10. A new account with no time zone yet does so at 5:00 pm.
- **Seen:** `active` flips to false and `past` to true for that member, while Matt (Phoenix) and Jane (Los Angeles) are still active. **Open tally** disappears from the event page, the event moves to Past, and the banner goes. Below are the stub's results using the backend's own `tripActive` logic:

  | Arizona time | Matt (Phoenix) | Jane (LA) | Sam (NY) | Kim (unset → UTC) |
  |---|---|---|---|---|
  | 5:30 pm | active | active | active | **past** |
  | 10:30 pm | active | active | **past** | past |

- **Why:** the backend judges "today" in the *member's* `users.timezone`, which is only set when the person opens the Alert Center (`AlertCenter.tsx`) and is null for new accounts (null counts as UTC). Evening owling is exactly when this bites.
- **Files:** backend `lib/places.js` (`tripActive`, `localDay`), `lib/events.js` (`listEvents`), front end `src/components/AlertCenter/AlertCenter.tsx`
- **Fix:** judge an event's day in the event area's time zone (from its state or county, `America/Phoenix` here), not the viewer's.

## Annoying

### 7. On the day, the route and meeting point are buried and depend on scouting
- **Steps:** open `/events/2` on the day.
- **Seen:** the order is title, Open tally, Plan, then **40 target chips (each with a remove ×)**, then scouting. The route is behind a "Plan a route" toggle at about y=2340 px of a 4300 px page. The toggle only renders when the scouting query succeeds *and* has places (`{data && … places.length > 0}`), so if scouting fails on weak signal, the saved group route can't be reached at all, even though it is a separate endpoint. The tally page has no route at all.
- **Files:** `src/components/Events/EventDetail.tsx`, `EventScouting.tsx`, `EventTally.tsx`
- **Fix:** when `event.active`, put the group route (meeting point, stops, Directions) right under Open tally, open and independent of scouting, and link to it from the tally.

### 8. Nothing on the day says which stop is next or whether the group is on schedule
- **Seen:** the route shows legs and stays ("Stay 2 h") but no clock times, no "next stop" and no current position. A screenshot of stop 1 looked fine apart from this.
- **Files:** `src/components/Events/EventRoute.tsx`, `customRoute.ts`
- **Fix:** on the day, show a planned arrive/leave time per stop from a start time, and highlight the next stop with its Directions link.

### 9. An offline add looks identical to a saved one, and every × is locked until it sends
- **Steps:** go offline and add a bird.
- **Seen (both engines):** the entry shows "You · 6:51 PM" like a synced one, with no pending or offline badge anywhere. **Every** undo × on the list is disabled while any tally request is paused or in flight (`disabled={tallyMutation.isPending}`), so mistakes can't be fixed offline. On reconnect, the queued adds were sent once each, in order, with no duplicates, and the server's `onConflict … ignore` also keeps them idempotent.
- **Files:** `src/components/Events/EventTally.tsx`, `src/hooks/mutations.ts`
- **Fix:** mark pending entries ("waiting for signal"), show an offline banner using `onlineManager`, and disable only that entry's ×.

### 10. On a weak connection a failed add disappears with a raw browser error
- **Steps:** add a bird while requests fail but `navigator.onLine` is true (the usual one-bar case).
- **Seen:** the toast says "Load failed" (Safari) or "Failed to fetch" (Chrome), the bird vanishes from the list (rollback) and nothing retries. The lifer prompt ("Add to life list") still appeared for the bird that didn't save.
- **Files:** `src/hooks/mutations.ts` (mutations retry 0 by default), `src/components/Events/EventTally.tsx` (`add` shows the prompt before the result), `src/apiCalls.ts` (`errorMessage` passes the TypeError through; there's no fetch timeout)
- **Fix:** retry tally writes with backoff (they're idempotent), keep the entry as pending instead of rolling back, say "No signal, will send when you're back online", and show the lifer prompt in `onSuccess`.

### 11. One tap of × removes a bird for the whole group, with no confirm or undo
- **Steps:** Sam taps × on Elegant Trogon, which Matt added.
- **Seen:** the server row is deleted immediately (2 → 1) for everyone. Re-adding it credits Sam with a new time, so Matt's name and the original time are lost. The "Still needed" chips (40 of them) also add a bird on a single tap, which is easy to hit by mistake in a moving car.
- **Files:** `src/components/Events/EventTally.tsx`, backend `lib/events.js` (`removeTally`)
- **Fix:** show an "Undo" toast for about 8 s after a removal (re-POST with the original adder), or ask for confirmation when removing someone else's bird.

### 12. A network error reads as "isn't on your list" or "doesn't work anymore"
- **Steps:** open the tally when the events fetch fails, or have a friend open the view-only link on a bad connection.
- **Seen:** the tally says "This event isn't on your list." and the friend sees "This link doesn't work anymore."
- **Files:** `EventTally.tsx`, `EventDetail.tsx`, `EventView.tsx`
- **Fix:** tell `isError` (a connection problem, with a retry) apart from a real 404.

### 13. The view-only link never refreshes for friends
- **Steps:** a friend opens `/events/view/<token>` on the day and leaves it open.
- **Seen:** one fetch at load and still one after 2 minutes. `useEventViewQuery` refreshes only when `data.active`, but the backend's `viewEvent` never returns `active`. The page also shows no "updated at" time.
- **Files:** `src/hooks/queries.ts` (`useEventViewQuery`), backend `lib/events.js` (`viewEvent`)
- **Fix:** return `active` from `viewEvent` (in the event area's time zone, see #6), or refresh whenever `starts_on <= today <= ends_on` on the client.

### 14. "Open whole route in Google Maps" can drop stops on a phone
- **Seen:** the link uses `waypoints=` with 4 waypoints for 5 stops. Google's Maps URLs documentation allows only 3 waypoints in mobile browsers, which is what an iPhone without the Google Maps app opens. Per-stop "Directions" links go to Google Maps on iPhone too, while the rest of the app (`Sighting.tsx`, `NearbyPublic.tsx`, `sw.js`) uses Apple Maps there. There is no Directions link to the meeting point itself.
- **Files:** `src/routePlan.ts` (`mapsUrl`), `src/components/Events/EventRoute.tsx`
- **Fix:** split routes into links of at most 3 waypoints (or one link per leg), use Apple Maps on Apple devices, and add Directions to the meeting point.

### 15. Pushes on the day
- **What happens:** for the day, each member is "visited" in Cochise (`activePlacesFor` → `pushAlerts.js`), so they get hourly target and notable pushes there plus their home county's unless `keep_home_alerts` is off. Quiet hours follow the member's account time zone, so a New York account's 22–6 quiet hours hold pushes from 8 pm to 4 am Arizona time, right through owling and dawn. Tapping a push takes the app off the tally page.
- **Files:** backend `lib/pushAlerts.js`, `lib/places.js`
- **Fix:** offer "Pause home alerts during this event" and judge quiet hours in the event's time zone on the day.

## Polish

- **16. No wake lock.** `navigator.wakeLock` exists in both engines, but the app never uses it, so the screen sleeps on the tally. Fix: add a "Keep screen on" toggle on the tally (`navigator.wakeLock.request('screen')`, re-requested on `visibilitychange`). File: `EventTally.tsx`.
- **17. The tally waits up to 30 s to catch up when the phone wakes.** Coming back from the lock screen doesn't refetch, because `refetchOnWindowFocus: false` is set globally. Fix: `refetchOnWindowFocus: true` for `useEventsQuery(live)`. File: `src/hooks/queries.ts`.
- **18. Adding a bird that's already on the tally does nothing, silently.** `add()` returns early. Fix: a short toast saying "Already on the tally (Matt, 7:42)". File: `EventTally.tsx`.
- **19. Targets are easy to delete on the day.** The 40 target chips on the event page each carry a × that removes the target for everyone at once. Fix: collapse the targets on the day, or confirm before removing. File: `EventDetail.tsx`.
- **20. Archiving an active event hides it from Events.** Archiving during the day moved it to "Archived (1)", and Upcoming then said "Nothing planned yet". Fix: don't offer Archive while `active`. Files: `EventDetail.tsx`, `EventsPage.tsx`.
- **21. "Email me the scouting report now" still shows on the day.** It's hidden only once `event_over` comes back. Fix: hide it while `active`. File: `EventScouting.tsx`.
- **22. Battery.** The tally polls the whole events payload every 30 s, and the route plan every 60 s while open. The persister also re-serialises the entire cache to localStorage up to once a second. That's fine for one day, but a lighter `?kind=event-tally&since=` poll would cost less.
- **23. Throttled load times.** On 400 ms RTT at 50 KB/s, the first open of the tally took about 7 s (about 280 KB transferred). The bird picker then answered locally at once, because the county list and names are persisted. Every later open re-validates every chunk because of `max-age=0` (see #1).
- **24. Harness artefact, not an app bug.** "Covers 40 of 30 targets" on the group route came from my stub sending unreported codes in `stops[].species`. The real server sends only reported codes there.

## What offline capability exists today (facts)

- **Service worker (`public/sw.js`):** registered on every load and updated each launch. It handles `push` and `notificationclick` only and has **no `fetch` handler**. Its only Cache Storage use is `bird-alert-pending-open`, which stores notification hand-off records (`/latest-push`, `/pending-open`), not app files. It caches no HTML, JS, CSS, images, API answers or map tiles.
- **HTTP caching (Vercel, read 2026-11-03):** `/`, `/events/2`, `/sw.js` **and** the hashed `/assets/*.js` are all `public, max-age=0, must-revalidate`, and `vercel.json` sets no headers. Every launch has to revalidate every file, so with no network the app doesn't start.
- **TanStack Query persistence (`src/queryClient.ts`):** queries with `meta.persist` that are still fresh are kept in localStorage for up to a week (buster `v4`). In practice that covers the county's species list, bird records, regions and similar. The session, events, tally, targets, scouting, the group route and drive times are **memory only**.
- **Mutations:** these use the default `networkMode: 'online'`. Offline, a tally add or remove is applied optimistically and paused, then sent once each when the browser fires `online`. Paused mutations are written to localStorage, but they can't run after a reload (no `mutationKey` or defaults), so they're lost. On weak signal (`onLine` true but requests failing) a write fails at once, rolls back and isn't retried.
- **What still works with the app open offline:** the event, route, targets and tally already on screen stay readable, and the stop list and Directions links stay visible. The bird picker searches locally if the county list loaded earlier. Pages whose code hasn't loaded fail (#5).
- **Maps:** Leaflet with OpenStreetMap tiles (`VITE_TILE_URL` fallback) and no tile caching. Offline, only tiles still in the browser's own HTTP cache appear; new areas or zooms are blank. Route lines and pins still draw, since they're vector data from memory. Directions open Google Maps on the web, which needs signal unless the native app has offline maps downloaded.
- **Not present:** an offline or online indicator, `onlineManager` wiring, a fetch timeout, a wake lock, or background sync.

## Before Nov 10, without code changes

- Every member should open the app on the morning of the 10th with good signal, open the event, the tally and the route (with "Plan a route" expanded), and then **not close the app**.
- Each member should open the Home page once so their account picks up `America/Phoenix` (#6), and new members should do this after joining.
- Download offline Google Maps or Apple Maps for Cochise County, and save the meeting point and stops as pins in that app.
- In weak signal, keep adding birds anyway. Queued adds send once signal returns, as long as the app isn't reloaded or killed. After a "Load failed" toast, re-add the bird.
