# Devpost submission draft (JOSHUA reviews and submits)

**Name:** SkinMatch

**Tagline:** Paste your store. Get a skin check that sells your own products, with the ingredient behind every pick.

## Inspiration
A big beauty brand can afford in-store skin consultations and a custom quiz. A small skincare brand with 20 products has a product page and a hope that shoppers pick the right serum. Most skin-analysis demos answer a consumer question: "what's wrong with my skin?" We asked the merchant's question instead: how does a small brand turn a skin scan into a routine from its own shelf, without inventing a single claim?

## What it does
**For the merchant (about one minute):**
1. Paste a Shopify store domain. SkinMatch reads the store's public `products.json`.
2. Every face-care product is matched to skin concerns using only the ingredients named in its own title, tags and description. Niacinamide maps to pores and oil, retinoids to fine lines (and the evening), vitamin C to radiance (and the morning). The match keeps the ingredient as evidence.
3. Lips, body, hair, makeup, kits and travel sizes are left out automatically. Products with no listed actives are kept as basics, never claimed for a concern.
4. The merchant reviews every match, turns products on or off, fixes AM/PM, and sees catalog gaps ("No product for: redness").
5. One line of script adds a "Find my routine" button to their store. It opens the skin check in a popup without leaving the shop, with the merchant's review built into the line.

**For the shopper:**
1. They take one selfie. A consent line says the photo goes to the YouCam API for analysis and is not stored by SkinMatch.
2. The YouCam AI Skin Analysis API scores 10 areas: acne, pores, texture, hydration, oil, redness, radiance, dark circles, dark spots and fine lines.
3. Tapping an area overlays the YouCam detection mask on their photo.
4. SkinMatch builds a short routine (cleanser, moisturizer, SPF, plus up to 2 treatments for their 3 lowest-scoring areas), split into morning and evening. Every card says why, for example "For pores: contains niacinamide".
5. One tap adds the routine to the bag, and the shopper can still edit the bag.
6. It works on a phone, and a "Use a sample face" option lets anyone try it without a selfie.

## How we built it
- **YouCam AI Skin Analysis (V2 API):** File API with a pre-signed upload, then a `skin-analysis` task with 10 SD actions, polled until it succeeds. The `mask_urls` drive the per-concern overlays.
- **Server:** Vercel serverless functions. The API key stays server-side. Per-IP and daily caps protect the prepaid unit balance. Input is limited to JPEG/PNG under 3 MB.
- **Catalog reader:** `/api/catalog` fetches only `https://<store>/products.json`, with SSRF guards (public hostnames only, private-IP DNS check, no redirects, an 8 s timeout and a 5 MB cap).
- **Matching:** a transparent rule table (18 ingredient families mapped to the 10 YouCam concerns with weights). No model guesses, so every recommendation can be traced to a word on the merchant's own page.
- **Routine builder:** ranks the shopper's 3 lowest raw scores, weights each product by how directly its ingredients target them, and always includes cleanser, moisturizer and SPF.
- **Design:** the demo brand, Fieldnote Skin, is built as a printed field note: a two-ink walnut and bone palette, the skin report as a specimen sheet, the routine as a receipt. Product packaging is drawn in code for the fictional brand; real stores show their own product photos. Botanical plates are 19th-century public-domain prints, credited on the page.
- YouCam's detections are shown exactly as returned; only their rendering changes per type (a soft tint for oil and redness, fine scan marks for pores and lines), so they read as skin, not paint.
- Vanilla JS, no framework. Tests cover matching, routines, SSRF guards, the API flow (mocked) and every finding of an independent break-it review.

## Challenges
- **Real catalogs are messy.** On a live store, our first pass read lip balms, sachets and keychains as skincare steps. The exclusion rules came from running real public catalogs, not guesses.
- **"Use with SPF" is advice, not an ingredient.** A brightening serum's copy matched our SPF rule, so SPF now counts only for sunscreens.
- **Keeping claims honest.** Recommendations cite the merchant's own ingredient list and nothing else. The copy is cosmetic only.

## What we learned
The value of skin analysis for a small brand isn't the score. It's the step after the score: which of *my* products, and why.

## What's next
- A Shopify theme app block instead of a script tag.
- Merchant analytics: which concerns shoppers scan for most, against catalog gaps.
- YouCam skin-tone analysis for SPF and tinted-product matching.

## Try it
- Merchant: https://skinmatch-hazel.vercel.app/merchant.html, then "Use the demo store" (Fieldnote Skin is fictional)
- Storefront with the one-line install: https://skinmatch-hazel.vercel.app/demo-store/shop.html, then "Find my routine"
- Shopper: https://skinmatch-hazel.vercel.app/, then "Use a sample face" (an AI-generated fictional person), or take your own selfie
- Video: `<YouTube URL>`
- Code: `<repo URL>`
