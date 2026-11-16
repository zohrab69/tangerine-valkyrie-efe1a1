"""Short vertical product videos (720x1280, about 12-20 s) for TikTok, Reels and Shorts. Free, on the server.

make_video(req, synth_wav) -> mp4 bytes
  req = {"images": [https urls, max 5], "hook": "...", "lines": ["...", ...max 3], "price": "29.99 CAD", "brand": "Rangéo"}
  synth_wav(text) -> wav bytes (JARVIS's Kokoro voice)
Each segment = one photo (blurred background + the photo, slow zoom) + one spoken line + the line as a caption.
The hook is spoken and shown big first; the last segment shows the brand and price.
"""
import io
import os
import subprocess
import tempfile
import textwrap
import urllib.request
import wave

FONT = os.environ.get("VIDEO_FONT", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
W, H, FPS = 720, 1280, 25
MAX_IMG = 8 * 1024 * 1024


def _fetch(url, path):
    if not str(url).startswith("https://"):
        raise ValueError("image url must be https")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (JARVIS video)"})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = r.read(MAX_IMG + 1)
    if len(data) > MAX_IMG:
        raise ValueError("image too large")
    with open(path, "wb") as f:
        f.write(data)


def _wav_seconds(b):
    with wave.open(io.BytesIO(b)) as w:
        return w.getnframes() / float(w.getframerate())


def _wrap(text, width):
    return "\n".join(textwrap.wrap(" ".join(str(text).split()), width=width)[:4])


def _run(args):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"] + args, check=True, timeout=180, capture_output=True)


def make_video(req, synth_wav):
    images = [u for u in (req.get("images") or []) if isinstance(u, str)][:5]
    hook = " ".join(str(req.get("hook", "")).split())[:80]
    lines = [" ".join(str(x).split())[:120] for x in (req.get("lines") or []) if str(x).strip()][:3]
    price = " ".join(str(req.get("price", "")).split())[:30]
    brand = " ".join(str(req.get("brand", "")).split())[:30]
    if not images or not (hook or lines):
        raise ValueError("images and hook/lines are required")
    with tempfile.TemporaryDirectory() as tmp:
        pics = []
        for i, u in enumerate(images):
            p = os.path.join(tmp, f"img{i}")
            try:
                _fetch(u, p)
                pics.append(p)
            except Exception as e:
                print("video: image skipped:", type(e).__name__, flush=True)
        if not pics:
            raise ValueError("no image could be downloaded")
        texts = ([hook] if hook else []) + lines
        segs = []
        for i, t in enumerate(texts):
            wav = synth_wav(t)
            wp = os.path.join(tmp, f"a{i}.wav")
            open(wp, "wb").write(wav)
            dur = max(1.6, _wav_seconds(wav) + 0.35)
            last = i == len(texts) - 1
            if last and (brand or price):
                dur += 1.2
            tf = os.path.join(tmp, f"t{i}.txt")
            open(tf, "w", encoding="utf-8").write(_wrap(t, 16 if i == 0 and hook else 24))
            big = i == 0 and hook
            draw = (f"drawtext=fontfile={FONT}:textfile={tf}:fontcolor=white:fontsize={64 if big else 46}:line_spacing=10:"
                    f"box=1:boxcolor=black@0.55:boxborderw=22:x=(w-text_w)/2:y={'90' if big else 'h-text_h-200'}")
            if last and (brand or price):
                ef = os.path.join(tmp, f"e{i}.txt")
                open(ef, "w", encoding="utf-8").write((brand + ("  ·  " if brand and price else "") + price).strip())
                draw += (f",drawtext=fontfile={FONT}:textfile={ef}:fontcolor=white:fontsize=52:box=1:boxcolor=0x1f6feb@0.85:"
                         f"boxborderw=20:x=(w-text_w)/2:y=110:enable='gte(t,{max(0.0, dur - 2.2):.2f})'")
            vf = (f"[0:v]split[a][b];[a]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},boxblur=24:2,eq=brightness=-0.08[bg];"
                  f"[b]scale=w='trunc({W - 60}*(1+0.07*t/{dur:.2f})/2)*2':h=-2:eval=frame[fg];"
                  f"[bg][fg]overlay=(W-w)/2:(H-h)/2+20:shortest=1,{draw},format=yuv420p[v]")
            out = os.path.join(tmp, f"s{i}.mp4")
            _run(["-loop", "1", "-framerate", str(FPS), "-t", f"{dur:.2f}", "-i", pics[i % len(pics)], "-i", wp,
                  "-filter_complex", vf, "-map", "[v]", "-map", "1:a", "-af", "apad", "-t", f"{dur:.2f}",
                  "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-r", str(FPS),
                  "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2", out])
            segs.append(out)
        lst = os.path.join(tmp, "list.txt")
        open(lst, "w").write("".join(f"file '{s}'\n" for s in segs))
        final = os.path.join(tmp, "video.mp4")
        _run(["-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", "-movflags", "+faststart", final])
        return open(final, "rb").read()
