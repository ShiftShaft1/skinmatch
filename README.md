# SkinMatch

Paste your store, get a skin check that sells your own products.

**Merchant:** paste a Shopify domain. SkinMatch reads the public `products.json` and matches every face-care product to skin concerns using only the ingredients in its own listing, keeping each ingredient as evidence. The merchant reviews the matches and adds one script tag.

**Shopper:** one selfie. The **YouCam AI Skin Analysis API** scores 10 areas and shows where each appears. SkinMatch builds a short AM and PM routine from that store's shelf, and every pick says why ("For pores: contains niacinamide").

Demo brand: *Fieldnote Skin* (fictional, `demo-store/products.json`).

## How it works

1. The shopper takes or uploads a selfie. The browser resizes it (long side up to 1600 px, short side at least 480 px, per YouCam's SD spec).
2. `POST /api/analyze` uploads it with the YouCam File API (pre-signed PUT), then starts a `skin-analysis` task with 10 SD actions: acne, pore, texture, moisture, oiliness, redness, radiance, dark_circle_v2, age_spot, wrinkle.
3. The browser polls `GET /api/result?id=` until the task succeeds, then shows the scores. Tapping an area overlays its YouCam mask on the photo.
4. `ingest.js` turns a Shopify catalog into concern targets with evidence (an ingredient rule table, with lips, body, makeup, kits and travel sizes excluded). `recommend.js` ranks the shopper's three lowest-scoring areas and picks cleanser, moisturizer and SPF plus up to 2 best-fit treatments, split into AM and PM.
5. "Add routine to bag" puts the whole routine in the cart.

Merchant flow: `merchant.html`, then `/api/catalog?store=` (SSRF-guarded fetch of the public `products.json`), review the matches, then the `embed.js` one-line install.

## Safety and cost controls

- The API key lives only in the server env var `YOUCAM_API_KEY`. It never reaches the browser.
- Rate limits: `PER_IP_PER_DAY` (default 6) and `DAILY_CAP` (default 100) analyses per instance. The hard ceiling is the prepaid YouCam unit balance, with no overage billing.
- Input checks: JPEG or PNG data URL only, 3 MB max, task ids validated.
- Photos are passed to YouCam and not stored by this app.
- The copy is cosmetic only, not medical advice.

## Run it

```bash
npm i -g vercel
vercel dev            # set YOUCAM_API_KEY in .env.local (git-ignored)
```

Without a key, the "Try with a sample face" button still runs the full flow on a bundled result. To replace that bundled result with real API output (scores plus mask images):

```bash
YOUCAM_API_KEY=... node scripts/capture-sample.mjs
```

Tests: `npm test`. They cover concern ranking and routine building.

## Deploy

`vercel --prod`, then set `YOUCAM_API_KEY` (and optionally `DAILY_CAP` and `PER_IP_PER_DAY`) in the Vercel project's environment variables.

## Credits

The sample face is an AI-generated fictional person. Skin analysis is by the Perfect Corp. YouCam API. MIT licence.
