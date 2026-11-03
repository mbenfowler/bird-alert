# Marketing slides

The Instagram deck (seven 1080×1350 slides) and a 1080×1920 story. The phone screens in them are
the real app, rendered in WebKit from made-up data, so they stay current when the app changes:
re-render instead of re-shooting by hand.

The finished PNGs are committed in [`out/`](out/):

| File | Pill | Headline | What it shows |
| --- | --- | --- | --- |
| `01-cover.png` | Free · made by a birder | Know where the birds are this morning. | The home screen: watch-list sightings and the county's birds. A Carolina Parakeet print. "Swipe →". |
| `02-alerts.png` | Alerts that matter | Rare birds, soon after they're reported. | Notable cards in Cochise County, AZ (labelled so) at ABA Codes 5, 4, 3 and 2 (the card heat), and two push notifications in the server's own wording. |
| `03-evidence.png` | Is it real? | Check the evidence before you drive. | A confirmed report and an unreviewed one, as the sighting page labels them, and the "Only once there's proof" switch. |
| `04-where-to-go.png` | Where to go | A short route for the birds you want. | Where to go with the morning route, and Best hotspots for one bird (most reliable, last seen). |
| `05-big-day.png` | Big Day scouting | Scout your Big Day all week. | An event's Scouting section: summary bar, numbered map, place cards. A Roseate Spoonbill print. |
| `06-group.png` | Plan it with your group | One route for the whole group. | The group's route: time at each stop (set and suggested), drive legs, the "Driving · At stops · Total" line, the stay stepper in the editor, and the invite link. |
| `07-free.png` | Add it to your Home Screen | Free. No ads. No app store. | The iPhone install steps, the URL and the app's eBird credit line. Snowy Owl and Ivory-billed Woodpecker prints. |
| `story.png` | Free · made by a birder | Know where the birds are this morning. | The cover on one screen, with the URL. |

Wording rule: alerts arrive *soon after* a report reaches eBird, never "the moment". The app
checks eBird on a schedule; promising more would be untrue.

## Regenerating

```sh
npm run slides                  # every app screen, then every slide
npm run slides -- --slides      # only the slides, from the screens already shot
npm run slides -- --only=route  # one screen (by its name in render.mjs), then the slides
```

`render.mjs` starts Vite on a free port, opens each screen in WebKit at 390 px wide and 3×, with
every `/api` call answered from `fixtures.mjs`, the clock started at Saturday 25 April 2026,
7:12 am Eastern, and motion off. The clock runs while the page loads (Leaflet needs it to place
the map), then stops at 7:12:55 before anything is captured, so relative times such as "14 minutes
ago" never change. Each screen gets a fresh browser context. Then it opens each `slides/*.html` at
slide size and saves `out/<name>.png`. Two renders in a row give byte-identical PNGs; if a change
breaks that, look for hover, focus or a timer the page still has running.

The first run needs the network: Google Fonts, bird photos (each species' Wikipedia lead image,
the same source the app's server uses), Audubon plates, OpenStreetMap tiles and drive routes from
OSRM's public router (which the app's server also uses). Photos, plates, tiles and routes are
cached in `marketing/.cache` (not committed), so later runs come out the same.

## Credits

- **Bird photos** are used only if Wikimedia Commons lists them as CC BY, CC BY-SA, CC0 or public
  domain. If a species' lead image isn't, the script takes the article's next photo that is.
  A slide whose phone shows photos has a `<p class="credit" data-photos="<screen>">`; the script
  fills it in with only the photos that are actually visible on that slide.
- **Audubon plates** (*The Birds of America*, Havell edition) are public domain. The script refuses
  a plate that Commons doesn't list that way. They are drawn as old prints by the `.print` styles
  in `slides.css` (torn edge, tape, shadow, tilt), with the caption "<Bird>, after Audubon".
- Every render rewrites [`CREDITS.md`](CREDITS.md) and `out/caption-credits.txt`, a block to
  paste into the post caption.

Editing a slide: change its HTML or `slides/slides.css`, then `npm run slides -- --slides`. Fonts
and colours are the app's (Bungee, Fredericka the Great, the grey canvas and gold accent).
"ALERT!" uses the orange gradient, never the colour font, so it can't come out black.

Rendering is never part of CI. `npm run slides:check` lints and type-checks the scripts.

## The fixture data must stay fictional

Everything on these slides is posted publicly, so `fixtures.mjs` follows three rules:

- **Places:** only public eBird hotspots, by their real names (Hall County, Georgia; Cochise
  County, Arizona). Never a personal location, a yard, a private ranch or anyone's address. The
  meeting point is a town.
- **People:** no observer names, ever. Group members are invented first names (Robin, Sam, Priya)
  and the account email is `@example.com`.
- **Reports:** every sighting, count, date, checklist count, chance and checklist ID is made up.
  Checklist IDs are `S9000…` and location IDs `L99…`, numbers eBird has not reached, so they lead nowhere real.

Species and their ABA codes should be real and believable for the place and season. Check a
rarity's code before adding it.
