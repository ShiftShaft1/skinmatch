# Demo video storyboard (built first; only what is on this board gets polished)

Target: 2:45. On-screen captions, no voice (soft royalty-free music or silence). Screen recording on a phone-width browser plus desktop for the merchant part. No third-party trademarks: the demo store is the fictional Fieldnote Skin.

| # | Time | Screen | Caption |
|---|---|---|---|
| 1 | 0:00-0:12 | A product page with 9 serums and no guidance | "Small skincare brands lose shoppers at one question: which one is for me?" |
| 2 | 0:12-0:25 | Merchant page: paste the store URL, press Build | "SkinMatch turns a store's own catalog into a skin-check widget." |
| 3 | 0:25-0:50 | Mapping table fills in: product, concern, evidence ("niacinamide" highlighted in its ingredient list) | "Every product is matched to skin concerns from its own ingredient list. No claims are invented." |
| 4 | 0:50-1:00 | Merchant fixes one mapping and copies the one-line embed code | "The merchant can review and edit every match before it goes live." |
| 5 | 1:00-1:20 | Shopper view on a phone: consent line, guided selfie | "The shopper takes one selfie. Nothing is stored." |
| 6 | 1:20-1:45 | Scan animation, then 10 scores; tap Pores and the YouCam mask overlays the photo | "YouCam AI Skin Analysis scores 10 areas and shows where each one appears." |
| 7 | 1:45-2:15 | AM/PM routine; each card shows "Why: contains niacinamide" | "The routine comes only from this store, and each pick shows the ingredient behind it." |
| 8 | 2:15-2:30 | Add routine to bag, bag total | "One tap from skin check to cart." |
| 9 | 2:30-2:45 | Architecture card: browser, SkinMatch API (key server-side, rate limits), YouCam | "Built on the YouCam Skin Analysis API. Key stays server-side. Rate limited. Cosmetic guidance, not medical advice." |

## What each shot needs (build list)
- Shot 2-4: `merchant.html`, `/api/catalog` (safe fetch of a store's public `products.json`), `ingest.js` (ingredient to concern rules with evidence), editable table, embed snippet.
- Shot 5: the consent line and capture tips (done); optional YouCam JS Camera Kit guided capture.
- Shot 6: real masks from the real API (needs the key; run `scripts/capture-sample.mjs`).
- Shot 7: "Why: contains X" evidence on each card (`recommend.js` carries `evidence`).
- Shot 9: a simple architecture image.
