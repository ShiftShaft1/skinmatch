"""Edit the SkinMatch demo from record_hq.py output: 1920x1080, 60 fps, captions, title/architecture/end cards.
Usage: python compose_hq.py <dir with merchant/store/shopper/phone .mp4 + .json>"""
import json, subprocess, sys
from pathlib import Path

D = Path(sys.argv[1]); T = D / "txt"; T.mkdir(exist_ok=True); SEG = D / "seg"; SEG.mkdir(exist_ok=True)
HERE = Path(__file__).resolve().parent
ARCH = (HERE.parents[1] / "docs" / "architecture.png").as_posix()
FD = (HERE / "fonts").as_posix().replace(":", "\\:")
BOLD, REG = f"{FD}/bricolage-600.ttf", f"{FD}/bricolage-400.ttf"
BG, INK, MUTED, ACCENT = "0x2b2216", "0xe4e2da", "0xb3aa9b", "0xbda38b"
FPS = 60
ENC = ["-c:v", "libx264", "-crf", "16", "-preset", "slow", "-pix_fmt", "yuv420p", "-r", str(FPS), "-an"]
beats = {k: json.loads((D / f"{k}.json").read_text()) for k in ("merchant", "store", "shopper", "phone")}


def txt(name, s):
    p = T / f"{name}.txt"; p.write_bytes(s.encode("utf-8"))  # LF only
    return p.as_posix().replace(":", "\\:")


def dt(name, s, size, x, y, font=BOLD, color=INK, when=None, spacing=14):
    e = f":enable='between(t,{when[0]:.2f},{when[1]:.2f})'" if when else ""
    return f"drawtext=fontfile='{font}':textfile='{txt(name, s)}':fontsize={size}:fontcolor={color}:x={x}:y={y}:line_spacing={spacing}{e}"


def run(args):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *args], check=True)


def fades(d):
    return f"fade=t=in:st=0:d=0.35,fade=t=out:st={d - 0.35:.2f}:d=0.35"


def card(name, d, layers):
    run(["-f", "lavfi", "-i", f"color=c={BG}:s=1920x1080:r={FPS}:d={d}", "-vf", ",".join(layers + [fades(d)]), *ENC, str(SEG / f"{name}.mp4")])


def screen(name, src, b, start_key, end_key, caps, phone=False):
    """caps: list of (from_key, to_key or None, text). Times are relative to the recording's beats."""
    s0, s1 = b[start_key] - 0.4, b[end_key] + 0.2
    d = s1 - s0
    def t(k): return d if k is None else b[k] - s0
    if phone:  # phone frame left, large captions right
        place = f"[0:v]fps={FPS},scale=500:1080[v];[bg][v]overlay=300:0:shortest=1"
        layers = [dt(f"{name}{i}", s, 58, 920, 430, BOLD, INK, (t(a), t(z)), 18) for i, (a, z, s) in enumerate(caps)]
    else:      # 1600x900 recording at 1680x945, caption band below
        place = f"[0:v]fps={FPS},scale=1680:945:flags=lanczos[v];[bg][v]overlay=120:16:shortest=1"
        layers = [dt(f"{name}{i}", s, 38, "(w-tw)/2", 1000, BOLD, INK, (t(a), t(z))) for i, (a, z, s) in enumerate(caps)]
    run(["-ss", f"{s0:.2f}", "-to", f"{s1:.2f}", "-i", str(D / src), "-filter_complex",
         f"color=c={BG}:s=1920x1080:r={FPS}[bg];{place}," + ",".join(layers + [fades(d)]), *ENC, str(SEG / f"{name}.mp4")])


m, st, sh, ph = beats["merchant"], beats["store"], beats["shopper"], beats["phone"]

card("01_title", 4.5, [
    dt("t1", "SkinMatch", 132, "(w-tw)/2", 370),
    "drawbox=x=900:y=540:w=120:h=5:color=" + ACCENT + ":t=fill",
    dt("t2", "Paste your store. Get a skin check that sells your own products.", 44, "(w-tw)/2", 590, REG, MUTED),
])
card("02_problem", 5.5, [
    dt("p1", "A small skincare brand has twenty products\nand one question it can't answer at scale:", 52, "(w-tw)/2", 350, REG, INK, None, 20),
    dt("p2", "“Which one is for me?”", 92, "(w-tw)/2", 590, BOLD, ACCENT),
])
screen("03_merchant", "merchant.mp4", m, "hero", "end", [
    ("hero", "table", "For the merchant: paste a Shopify store. Here, the fictional demo store."),
    ("table", "off", "Every product is matched to skin concerns from its own ingredient list. No claims are invented."),
    ("off", "step", "Turn a product off and SkinMatch shows the gap: nothing left for radiance."),
    ("step", "golive", "Set morning or evening for any product."),
    ("golive", None, "One line of script installs it, with the merchant's review built in."),
])
screen("04_store", "store.mp4", st, "shop", "end", [
    ("shop", "modal", "On the store, the install adds one button."),
    ("modal", None, "It opens the skin check without leaving the shop."),
])
screen("05_shopper", "shopper.mp4", sh, "intro", "end", [
    ("intro", "scan", "One selfie, nothing stored. (Demo selfie: an AI-generated fictional person.)"),
    ("scan", "results", "YouCam AI Skin Analysis reads ten areas. This is a live API call."),
    ("results", "mask", "The skin field note: an overall score and the three areas to focus on."),
    ("mask", "routine", "Tap any area to see YouCam's own detection on the face."),
    ("routine", "bag", "The routine comes only from this store's shelf. Every pick names its ingredient."),
    ("bag", "remove", "One tap puts the whole routine in the bag."),
    ("remove", None, "Shoppers can still change the bag before checkout."),
])
screen("06_phone", "phone.mp4", ph, "intro", "end", [
    ("intro", "sample", "Built for the phone,\nwhere shoppers are."),
    ("sample", "mask", "No selfie handy?\nTry the sample face."),
    ("mask", "routine", "The same report,\nthe same YouCam\ndetections."),
    ("routine", None, "Morning and evening,\non one receipt."),
], phone=True)
run(["-loop", "1", "-t", "6", "-i", ARCH, "-vf", f"scale=1920:1080:flags=lanczos,{fades(6)}", *ENC, str(SEG / "07_arch.mp4")])
card("08_end", 6, [
    dt("e1", "SkinMatch", 112, "(w-tw)/2", 320),
    dt("e2", "Built on the Perfect Corp. YouCam AI Skin Analysis API", 42, "(w-tw)/2", 480, REG, INK),
    dt("e3", "Every pick is traced to an ingredient on the merchant's own page.", 36, "(w-tw)/2", 550, REG, MUTED),
    dt("e4", "skinmatch-hazel.vercel.app", 40, "(w-tw)/2", 680, BOLD, ACCENT),
    dt("e5", "Cosmetic guidance only, not medical advice.  Fieldnote Skin is a fictional demo brand.", 26, "(w-tw)/2", 900, REG, MUTED),
])

parts = sorted(SEG.glob("*.mp4"))
(D / "list.txt").write_text("".join(f"file '{p.as_posix()}'\n" for p in parts))
out = D / "SkinMatch-demo.mp4"
run(["-f", "concat", "-safe", "0", "-i", str(D / "list.txt"), "-c", "copy", "-movflags", "+faststart", str(out)])
dur = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(out)]).decode().strip()
print(out, dur, "s")
