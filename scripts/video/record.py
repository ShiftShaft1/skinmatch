"""Record the SkinMatch demo against the live site. Writes merchant.webm, shopper.webm and beats.json
(seconds from page start for each storyboard beat)."""
import json, time, shutil, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "https://skinmatch-hazel.vercel.app"
OUT = Path(__file__).parent
FACE = r"C:\Users\sankalp\code\skinmatch\assets\sample-face.jpg"
beats = {}  # rewritten on every full run


def smooth_scroll(page, dy, steps=40, pause=0.03):
    for _ in range(steps):
        page.mouse.wheel(0, dy / steps)
        time.sleep(pause)


def record_merchant(p):
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1280, "height": 760}, device_scale_factor=1,
                        record_video_dir=str(OUT / "raw_m"), record_video_size={"width": 1280, "height": 760},
                        color_scheme="light")
    page = ctx.new_page()
    t0 = time.time(); mark = lambda k: beats.setdefault("m_" + k, round(time.time() - t0, 2))
    page.goto(BASE + "/merchant.html", wait_until="networkidle")
    mark("hero"); time.sleep(3)
    page.click("#demoBtn"); page.wait_for_selector("#rows tr"); time.sleep(0.8)
    mark("table"); time.sleep(3)
    smooth_scroll(page, 300, 50); mark("evidence"); time.sleep(4)
    smooth_scroll(page, 380, 50); time.sleep(2.5)
    rows = page.locator("#rows tr")
    rows.nth(5).locator("input").click(); time.sleep(1.2)   # turn one product off
    rows.nth(0).locator("select").select_option("am"); time.sleep(1.2)
    mark("edit"); time.sleep(1.5)
    page.evaluate("window.scrollTo({top: document.querySelector('.golive').offsetTop - 40, behavior: 'smooth'})"); time.sleep(1)
    mark("golive"); time.sleep(4)
    preview = page.get_attribute("#preview", "href")
    mark("end")
    ctx.close(); b.close()
    return preview


def record_shopper(p, url):
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1280, "height": 760}, device_scale_factor=1,
                        record_video_dir=str(OUT / "raw_s"), record_video_size={"width": 1280, "height": 760},
                        color_scheme="light")
    page = ctx.new_page()
    t0 = time.time(); mark = lambda k: beats.setdefault("s_" + k, round(time.time() - t0, 2))
    page.goto(url, wait_until="networkidle")
    time.sleep(0.4); mark("intro"); time.sleep(4)
    page.set_input_files("#photo", FACE)
    mark("scan")
    page.wait_for_selector("#v-result:not([hidden])", timeout=120000)
    mark("results"); time.sleep(3.2)
    smooth_scroll(page, 230, 30); time.sleep(0.6)
    page.locator("#scores button", has_text="Oil balance").click(); mark("mask1"); time.sleep(3.2)
    page.locator("#scores button", has_text="Pores").click(); time.sleep(3.2)
    page.locator("#scores button", has_text="Pores").click(); time.sleep(0.4)
    page.evaluate("window.scrollTo({top: document.querySelector('.routine-wrap').offsetTop - 30, behavior: 'smooth'})")
    time.sleep(0.8); mark("routine"); time.sleep(4)
    smooth_scroll(page, 520, 50); time.sleep(2.5)
    page.click("#addAll"); mark("bag"); time.sleep(3.5)
    mark("end")
    ctx.close(); b.close()


ONLY_SHOPPER = '--shopper' in sys.argv
with sync_playwright() as p:
    preview = BASE + "/?store=demo&off=calm-spot-treatment&am=clear-day-gel-cleanser" if ONLY_SHOPPER else record_merchant(p)
    record_shopper(p, preview)

if ONLY_SHOPPER:
    old = json.loads((OUT / "beats.json").read_text()); old.update(beats); beats = old
for sub, name in ((() if ONLY_SHOPPER else (("raw_m", "merchant.webm"),)) + (("raw_s", "shopper.webm"),)):
    vids = sorted((OUT / sub).glob("*.webm"), key=lambda f: f.stat().st_mtime)
    shutil.move(str(vids[-1]), str(OUT / name))
(OUT / "beats.json").write_text(json.dumps(beats, indent=2))
print(json.dumps(beats, indent=2))
