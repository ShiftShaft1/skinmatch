"""Build the SkinMatch demo video (1920x1080, 30 fps, silent) from merchant.webm, shopper.webm and beats.json."""
import json, subprocess
from pathlib import Path

D = Path(__file__).parent
T = D / "txt"; T.mkdir(exist_ok=True)
SEG = D / "seg"; SEG.mkdir(exist_ok=True)
B = json.loads((D / "beats.json").read_text())
ARCH = r"C:/Users/sankalp/code/skinmatch/docs/architecture.png"
BG, INK, MUTED, ACCENT = "0x2b2216", "0xe4e2da", "0xb3aa9b", "0xbda38b"
FD = (D / "fonts").as_posix().replace(":", "\\:")  # Bricolage Grotesque, the page's face
SERIF, SANS, SANS_SB = f"{FD}/bricolage-600.ttf", f"{FD}/bricolage-400.ttf", f"{FD}/bricolage-600.ttf"
ENC = ["-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30", "-an"]


def txt(name, s):
    p = T / f"{name}.txt"; p.write_bytes(s.encode("utf-8"))  # LF only: a CR renders as an extra gap
    return p.as_posix().replace(":", "\\:")


def dt(file, size, x, y, font=SANS, color=INK, enable=None, spacing=12):
    e = f":enable='between(t,{enable[0]},{enable[1]})'" if enable else ""
    return f"drawtext=fontfile='{font}':textfile='{file}':fontsize={size}:fontcolor={color}:x={x}:y={y}:line_spacing={spacing}{e}"


def run(args):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *args], check=True)


def card(name, secs, layers):
    vf = ",".join(layers) + ",fade=t=in:st=0:d=0.4,fade=t=out:st=" + str(secs - 0.4) + ":d=0.4"
    run(["-f", "lavfi", "-i", f"color=c={BG}:s=1920x1080:r=30:d={secs}", "-vf", vf, *ENC, str(SEG / f"{name}.mp4")])


def captions(prefix, items, x, y, size, width_chars=None):
    return [dt(txt(f"{prefix}{i}", s), size, x, y, SANS_SB, INK, (a, b)) for i, (a, b, s) in enumerate(items)]


# 1. Title
card("01_title", 4.5, [
    dt(txt("t1", "SkinMatch"), 120, "(w-tw)/2", 380, SERIF),
    dt(txt("t2", "Paste your store. Get a skin check that sells your own products."), 44, "(w-tw)/2", 560, SANS, MUTED),
    "drawbox=x=900:y=520:w=120:h=4:color=" + ACCENT + ":t=fill",
])
# 2. Problem
card("02_problem", 5.5, [
    dt(txt("p1", "A small skincare brand has 20 products\nand one question it can't answer at scale:"), 52, "(w-tw)/2", 360, SANS, INK, spacing=18),
    dt(txt("p2", "\u201cWhich one is for me?\u201d"), 84, "(w-tw)/2", 600, SERIF, ACCENT),
])

# 3. Merchant screen recording, 1280x760 scaled to 1600x950, caption band below
m0, m1 = B["m_hero"] - 0.3, B["m_end"]
mc = [
    (0, B["m_table"] - m0, "For the merchant: paste a Shopify store. Here, the fictional demo store."),
    (B["m_table"] - m0, B["m_edit"] - m0 - 1.5, "Every product is matched to skin concerns from its own ingredient list. No claims are invented."),
    (B["m_edit"] - m0 - 1.5, B["m_golive"] - m0, "The merchant reviews every match: turn products off, fix morning or evening."),
    (B["m_golive"] - m0, m1 - m0 + 1, "One line of script adds the skin check to their store."),
]
run(["-ss", str(m0), "-to", str(m1), "-i", str(D / "merchant.webm"), "-filter_complex",
     f"color=c={BG}:s=1920x1080:r=30[bg];[0:v]fps=30,scale=1600:950:flags=lanczos[v];[bg][v]overlay=160:18:shortest=1,"
     + ",".join(dt(txt(f"mc{i}", s), 40, "(w-tw)/2", 1000, SANS_SB, INK, (a, b)) for i, (a, b, s) in enumerate(mc)),
     *ENC, str(SEG / "03_merchant.mp4")])

# 4. Shopper recording (desktop, same frame as the merchant part)
s0, s1 = B["s_intro"] - 0.3, B["s_end"]
sc = [
    (0, B["s_scan"] - s0, "For the shopper: one selfie. Nothing is stored. (Demo selfie: an AI-generated fictional person.)"),
    (B["s_scan"] - s0, B["s_results"] - s0, "YouCam AI Skin Analysis reads 10 areas of the skin. This is a live API call."),
    (B["s_results"] - s0, B["s_mask1"] - s0, "The skin field note: a score, and the three areas to focus on."),
    (B["s_mask1"] - s0, B["s_routine"] - s0, "Tap an area: YouCam's own detection shows where it appears."),
    (B["s_routine"] - s0, B["s_bag"] - s0, "The routine comes only from this store's shelf, and every pick names its ingredient."),
    (B["s_bag"] - s0, s1 - s0 + 1, "One tap from skin check to bag."),
]
run(["-ss", str(s0), "-to", str(s1), "-i", str(D / "shopper.webm"), "-filter_complex",
     f"color=c={BG}:s=1920x1080:r=30[bg];[0:v]fps=30,scale=1600:950:flags=lanczos[v];[bg][v]overlay=160:18:shortest=1,"
     + ",".join(dt(txt(f"sc{i}", s), 40, "(w-tw)/2", 1000, SANS_SB, INK, (a, b)) for i, (a, b, s) in enumerate(sc)),
     *ENC, str(SEG / "04_shopper.mp4")])

# 5. Architecture card
run(["-loop", "1", "-t", "6", "-i", ARCH, "-vf", "scale=1920:1080:flags=lanczos,fade=t=in:st=0:d=0.4,fade=t=out:st=5.6:d=0.4", *ENC, str(SEG / "05_arch.mp4")])

# 6. End card
card("06_end", 6, [
    dt(txt("e1", "SkinMatch"), 100, "(w-tw)/2", 330, SERIF),
    dt(txt("e2", "Built on the Perfect Corp. YouCam AI Skin Analysis API"), 40, "(w-tw)/2", 490, SANS, INK),
    dt(txt("e3", "Every pick is traced to an ingredient on the merchant's own page."), 34, "(w-tw)/2", 560, SANS, MUTED),
    dt(txt("e4", "Cosmetic guidance only, not medical advice.  Fieldnote Skin is a fictional demo brand."), 26, "(w-tw)/2", 860, SANS, MUTED),
])

parts = sorted(SEG.glob("*.mp4"))
(D / "list.txt").write_text("".join(f"file '{p.as_posix()}'\n" for p in parts))
out = D / "SkinMatch-demo.mp4"
run(["-f", "concat", "-safe", "0", "-i", str(D / "list.txt"), "-c", "copy", "-movflags", "+faststart", str(out)])
dur = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(out)]).decode().strip()
print(out, dur, "s")
