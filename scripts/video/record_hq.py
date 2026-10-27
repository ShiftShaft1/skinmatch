"""High-quality demo capture: Chrome's own screencast frames (JPEG q92) at 1920x1080, a visible
cursor that glides to each control, eased scrolling. Writes <part>.mp4 (60 fps) and beats.json per part.
Usage: python record_hq.py <out_dir> [base_url]   (parts: merchant, store, shopper, phone)"""
import asyncio, base64, json, subprocess, sys, time
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
BASE = sys.argv[2] if len(sys.argv) > 2 else "https://skinmatch-hazel.vercel.app"
FACE = str(Path(__file__).resolve().parents[2] / "assets" / "sample-face.jpg")

CURSOR = r"""(() => {
  if (window.__cur) return;
  const c = document.createElement('div');
  c.innerHTML = window.__touch
    ? '<div style="width:34px;height:34px;margin:-15px 0 0 -14px;border-radius:50%;background:rgba(255,255,255,.55);box-shadow:0 0 0 2px rgba(43,34,22,.5)"></div>'
    : '<svg width="28" height="28" viewBox="0 0 24 24"><path d="M3 2 L3 19 L8 14.5 L11.5 22 L14.5 20.6 L11 13.2 L17.5 13.2 Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  Object.assign(c.style, { position: 'fixed', left: 0, top: 0, zIndex: 2147483647, pointerEvents: 'none',
    transform: `translate(${window.__cx ?? 800}px, ${window.__cy ?? 840}px)`, transition: 'transform 700ms cubic-bezier(.3,.7,.2,1)',
    filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))' });
  document.documentElement.appendChild(c); window.__cur = c;
  window.__move = (x, y, ms) => { c.style.transitionDuration = ms + 'ms'; c.style.transform = `translate(${x - 3}px, ${y - 2}px)`; };
  window.__ripple = (x, y) => { const r = document.createElement('div');
    Object.assign(r.style, { position: 'fixed', left: (x - 20) + 'px', top: (y - 20) + 'px', width: '40px', height: '40px', borderRadius: '50%',
      background: 'rgba(189,163,139,.6)', zIndex: 2147483646, pointerEvents: 'none', transform: 'scale(.3)', opacity: 1,
      transition: 'transform .5s ease, opacity .5s ease' });
    document.documentElement.appendChild(r); requestAnimationFrame(() => { r.style.transform = 'scale(1.5)'; r.style.opacity = 0; });
    setTimeout(() => r.remove(), 700); };
  window.__scroll = (to, ms) => new Promise(done => { const from = scrollY, t0 = performance.now();
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const step = now => { const t = Math.min(1, (now - t0) / ms); scrollTo(0, from + (to - from) * ease(t)); t < 1 ? requestAnimationFrame(step) : done(); };
    requestAnimationFrame(step); });
})()"""


class Rec:
    def __init__(self, page, cdp, name):
        self.page, self.cdp, self.name = page, cdp, name
        self.frames, self.beats, self.t0 = [], {}, None
        self.dir = OUT / f"frames_{name}"; self.dir.mkdir(exist_ok=True)
        self.pos = (800, 840)
        self.touch = False

    async def start(self):
        async def on_frame(e):
            ts = e["metadata"]["timestamp"]
            if self.t0 is None: self.t0 = ts
            f = self.dir / f"{len(self.frames):05d}.jpg"; f.write_bytes(base64.b64decode(e["data"]))
            self.frames.append((ts, f))
            await self.cdp.send("Page.screencastFrameAck", {"sessionId": e["sessionId"]})
        self.cdp.on("Page.screencastFrame", lambda e: asyncio.ensure_future(on_frame(e)))
        await self.cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 92, "maxWidth": 1920, "maxHeight": 1080, "everyNthFrame": 1})

    def mark(self, k):
        self.beats[k] = round(time.time() - (self.t0 or time.time()), 2)

    async def cursor(self):
        await self.page.evaluate(f"window.__cx={self.pos[0]};window.__cy={self.pos[1]};window.__touch={'true' if self.touch else 'false'}")
        await self.page.evaluate(CURSOR)

    async def goto(self, url):
        await self.page.goto(url, wait_until="networkidle"); await self.cursor()

    async def move(self, loc, ms=750):
        box = await loc.bounding_box()
        x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
        await self.page.evaluate(f"window.__move({x},{y},{ms})"); self.pos = (x, y)
        await asyncio.sleep(ms / 1000 + 0.15)
        return x, y

    async def click(self, loc, ms=750):
        await loc.scroll_into_view_if_needed()
        x, y = await self.move(loc, ms)
        await self.page.evaluate(f"window.__ripple({x},{y})")
        await loc.click(); await asyncio.sleep(0.35)

    async def scroll_to(self, selector_or_y, ms=1400, offset=24):
        y = selector_or_y if isinstance(selector_or_y, (int, float)) else await self.page.evaluate(
            f"document.querySelector('{selector_or_y}').getBoundingClientRect().top + scrollY - {offset}")
        await self.page.evaluate(f"window.__scroll({y},{ms})"); await asyncio.sleep(ms / 1000 + 0.2)

    async def stop(self):
        await asyncio.sleep(0.6)
        await self.cdp.send("Page.stopScreencast"); await asyncio.sleep(0.3)
        lines = []
        for i, (ts, f) in enumerate(self.frames):
            nxt = self.frames[i + 1][0] if i + 1 < len(self.frames) else ts + 0.5
            lines += [f"file '{f.as_posix()}'", f"duration {max(0.001, nxt - ts):.4f}"]
        lines.append(f"file '{self.frames[-1][1].as_posix()}'")
        (OUT / f"{self.name}.ffconcat").write_text("ffconcat version 1.0\n" + "\n".join(lines) + "\n")
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(OUT / f"{self.name}.ffconcat"),
                        "-vf", "fps=60,scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-crf", "15", "-preset", "slow", "-pix_fmt", "yuv420p",
                        str(OUT / f"{self.name}.mp4")], check=True)
        (OUT / f"{self.name}.json").write_text(json.dumps(self.beats, indent=2))
        print(self.name, len(self.frames), "frames", self.beats)


async def session(browser, name, viewport, scale, mobile=False):
    ctx = await browser.new_context(viewport=viewport, device_scale_factor=scale, is_mobile=mobile, has_touch=mobile, color_scheme="light")
    page = await ctx.new_page()
    rec = Rec(page, await ctx.new_cdp_session(page), name)
    return ctx, page, rec


async def merchant(b):
    ctx, page, r = await session(b, "merchant", {"width": 1600, "height": 900}, 1)
    await r.start(); await r.goto(BASE + "/merchant.html"); r.mark("hero"); await asyncio.sleep(2.5)
    await r.move(page.locator("#store"), 900); await asyncio.sleep(0.4)
    await r.click(page.locator("#demoBtn")); await page.wait_for_selector("#rows tr"); await asyncio.sleep(1.2)
    r.mark("table"); await asyncio.sleep(1.5)
    await r.scroll_to("#rows", 1600, 140); r.mark("evidence"); await asyncio.sleep(2.2)
    await r.scroll_to(await page.evaluate("scrollY + 420"), 1600); await asyncio.sleep(1.5)
    row = page.locator("#rows tr", has_text="Morning Light Serum")
    await r.click(row.locator("input")); r.mark("off"); await asyncio.sleep(0.6)
    await r.scroll_to(".sheet-head", 1200, 30); r.mark("gap"); await asyncio.sleep(1.2)
    await r.move(page.locator(".summary .gap"), 700); await asyncio.sleep(2.2)
    await r.scroll_to("#rows", 1200, 140)
    sel = page.locator("#rows tr", has_text="Night Shift Serum").locator("select")
    await r.move(sel); await page.evaluate("window.__ripple(%f,%f)" % r.pos); await sel.select_option("pm"); r.mark("step"); await asyncio.sleep(1.4)
    await r.scroll_to(".golive", 1600, 40); r.mark("golive"); await asyncio.sleep(0.8)
    await r.move(page.locator("#embed"), 900); await asyncio.sleep(2.5)
    r.mark("end"); await r.stop(); await ctx.close()


async def store(b):
    ctx, page, r = await session(b, "store", {"width": 1600, "height": 900}, 1)
    await r.start(); await r.goto(BASE + "/demo-store/shop.html"); r.mark("shop"); await asyncio.sleep(2)
    await r.scroll_to(".shop", 1600, 30); await asyncio.sleep(1.2)
    btn = page.locator("button", has_text="Find my routine")
    await r.click(btn, 1000); r.mark("modal"); await asyncio.sleep(3.5)
    r.mark("end"); await r.stop(); await ctx.close()


async def shopper(b):
    ctx, page, r = await session(b, "shopper", {"width": 1600, "height": 900}, 1)
    await r.start(); await r.goto(BASE + "/?store=demo&off=calm-spot-treatment&am=clear-day-gel-cleanser"); r.mark("intro"); await asyncio.sleep(3)
    await r.move(page.locator("label[for=photo]"), 900); await page.evaluate("window.__ripple(%f,%f)" % r.pos)
    await page.set_input_files("#photo", FACE); r.mark("scan")
    await page.wait_for_selector("#v-result:not([hidden])", timeout=120000); r.mark("results"); await asyncio.sleep(3)
    await r.scroll_to(".sheet-grid", 1200, 20); await asyncio.sleep(0.4)
    for i, area in enumerate(("Oil balance", "Pores", "Fine lines")):
        await r.click(page.locator("#scores button", has_text=area), 650)
        if i == 0: r.mark("mask")
        await asyncio.sleep(2.6)
    await r.click(page.locator("#scores button", has_text="Fine lines"), 400)
    await r.scroll_to(".routine-wrap", 1800, 30); r.mark("routine"); await asyncio.sleep(1.2)
    await r.move(page.locator("#am li").nth(1), 800); await asyncio.sleep(2.4)
    await r.scroll_to(".slip-total", 1400, 420); await asyncio.sleep(0.6)
    await r.click(page.locator("#addAll")); r.mark("bag"); await asyncio.sleep(1.8)
    await r.click(page.locator("#bagList li", has_text="Wide Awake").locator("button")); r.mark("remove"); await asyncio.sleep(2)
    await r.click(page.locator("#closeBag")); await asyncio.sleep(1)
    r.mark("end"); await r.stop(); await ctx.close()


async def phone(b):
    ctx, page, r = await session(b, "phone", {"width": 500, "height": 1080}, 1, mobile=True)
    r.pos = (250, 900); r.touch = True
    await r.start(); await r.goto(BASE + "/?store=demo"); r.mark("intro"); await asyncio.sleep(1.5)
    await r.scroll_to(".actions", 1200, 300); await asyncio.sleep(0.4)
    await r.click(page.locator("#sampleBtn"), 700); r.mark("sample")
    await page.wait_for_selector("#v-result:not([hidden])"); await asyncio.sleep(2.2)
    await r.scroll_to(".observations", 1500, 10); await r.click(page.locator("#scores button", has_text="Oil balance"), 600)
    await r.scroll_to(".photo", 900, 60); r.mark("mask"); await asyncio.sleep(2.2)
    await r.scroll_to(".routine-wrap", 1800, 10); r.mark("routine"); await asyncio.sleep(1.5)
    await r.scroll_to(".slip", 1600, 10); await asyncio.sleep(2)
    r.mark("end"); await r.stop(); await ctx.close()


async def main():
    parts = sys.argv[3].split(",") if len(sys.argv) > 3 else ["merchant", "store", "shopper", "phone"]
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for name in parts:
            await globals()[name](b)
        await b.close()

asyncio.run(main())
