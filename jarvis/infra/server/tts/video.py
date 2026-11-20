"""Short vertical product videos (720x1280, about 10-20 s) for TikTok, Reels and Shorts. Free, on the server.

make_video(req, synth_wav) -> mp4 bytes
  req = {"videos": [supplier .mp4 urls, max 2], "images": [https urls, max 6], "hook": "...", "lines": ["...", max 4],
         "price": "29.99 CAD", "brand": "Rangéo", "voice": true}
  synth_wav(text) -> wav bytes (JARVIS's Kokoro voice)
Real footage first: when the supplier has a product video, each segment is a different moment of it (the product in use).
Otherwise each segment is a different product photo (blurred background, slow zoom). Each line = one segment with its
caption in TikTok style (white, black outline). The hook comes first, big; the last segment shows brand and price.
voice=false: captions only, silent track (the owner adds a trending sound in the app).
"""
import io
import json
import os
import struct
import subprocess
import tempfile
import textwrap
import urllib.request
import wave

FONT = os.environ.get("VIDEO_FONT", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
W, H, FPS = 720, 1280, 25
MAX_IMG = 8 * 1024 * 1024
MAX_VID = 40 * 1024 * 1024


def _fetch(url, path, limit):
    if not str(url).startswith("https://"):
        raise ValueError("url must be https")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (JARVIS video)"})
    with urllib.request.urlopen(req, timeout=40) as r, open(path, "wb") as f:
        size = 0
        while True:
            chunk = r.read(1 << 16)
            if not chunk:
                break
            size += len(chunk)
            if size > limit:
                raise ValueError("file too large")
            f.write(chunk)


def _wav_seconds(b):
    with wave.open(io.BytesIO(b)) as w:
        return w.getnframes() / float(w.getframerate())


def _silence(seconds, sr=24000):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(struct.pack("<h", 0) * int(sr * seconds))
    return buf.getvalue()


def _probe_seconds(path):
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", path],
                             capture_output=True, timeout=30, check=True).stdout
        return float(json.loads(out)["format"]["duration"])
    except Exception:
        return 0.0


def _wrap(text, width):
    return "\n".join(textwrap.wrap(" ".join(str(text).split()), width=width)[:4])


def _run(args):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"] + args, check=True, timeout=240, capture_output=True)


def make_video(req, synth_wav):
    videos = [u for u in (req.get("videos") or []) if isinstance(u, str)][:2]
    images = [u for u in (req.get("images") or []) if isinstance(u, str)][:6]
    hook = " ".join(str(req.get("hook", "")).split())[:80]
    lines = [" ".join(str(x).split())[:110] for x in (req.get("lines") or []) if str(x).strip()][:4]
    price = " ".join(str(req.get("price", "")).split())[:30]
    brand = " ".join(str(req.get("brand", "")).split())[:30]
    voice = req.get("voice", True) is not False
    if not (videos or images) or not (hook or lines):
        raise ValueError("videos or images, and hook/lines are required")
    with tempfile.TemporaryDirectory() as tmp:
        clips, pics = [], []
        for i, u in enumerate(videos):
            p = os.path.join(tmp, f"clip{i}.mp4")
            try:
                _fetch(u, p, MAX_VID)
                d = _probe_seconds(p)
                if d >= 2:
                    clips.append((p, d))
            except Exception as e:
                print("video: clip skipped:", type(e).__name__, flush=True)
        for i, u in enumerate(images):
            p = os.path.join(tmp, f"img{i}")
            try:
                _fetch(u, p, MAX_IMG)
                pics.append(p)
            except Exception as e:
                print("video: image skipped:", type(e).__name__, flush=True)
        if not clips and not pics:
            raise ValueError("no video or image could be downloaded")
        texts = ([hook] if hook else []) + lines
        sources = []                                   # (kind, path, start)
        clip_pos = 0.0
        for i in range(len(texts)):
            if clips:
                path, d = clips[i % len(clips)]
                sources.append(("clip", path, clip_pos % max(0.1, d - 2.0)))
                clip_pos += 2.7
            else:
                sources.append(("img", pics[i % len(pics)], 0))
        segs = []
        for i, t in enumerate(texts):
            wav = synth_wav(t) if voice else _silence(max(1.8, 0.075 * len(t)))
            wp = os.path.join(tmp, f"a{i}.wav")
            open(wp, "wb").write(wav)
            dur = max(1.8, _wav_seconds(wav) + 0.3)
            last = i == len(texts) - 1
            if last and (brand or price):
                dur += 1.3
            big = i == 0 and hook
            tf = os.path.join(tmp, f"t{i}.txt")
            open(tf, "w", encoding="utf-8").write(_wrap(t, 15 if big else 22))
            draw = (f"drawtext=fontfile={FONT}:textfile={tf}:fontcolor=white:fontsize={66 if big else 50}:line_spacing=12:"
                    f"borderw=5:bordercolor=black@0.9:x=(w-text_w)/2:y={'150' if big else 'h-text_h-240'}")
            if last and (brand or price):
                ef = os.path.join(tmp, f"e{i}.txt")
                open(ef, "w", encoding="utf-8").write((brand + ("  ·  " if brand and price else "") + price).strip())
                draw += (f",drawtext=fontfile={FONT}:textfile={ef}:fontcolor=white:fontsize=54:box=1:boxcolor=0x1f6feb@0.9:"
                         f"boxborderw=22:x=(w-text_w)/2:y=110:enable='gte(t,{max(0.0, dur - 2.3):.2f})'")
            kind, src, start = sources[i]
            if kind == "clip":
                inp = ["-ss", f"{start:.2f}", "-t", f"{dur:.2f}", "-i", src]
                fg = f"[b]scale={W}:-2[fg]"
            else:
                inp = ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur:.2f}", "-i", src]
                fg = f"[b]scale=w='trunc({W - 40}*(1+0.08*t/{dur:.2f})/2)*2':h=-2:eval=frame[fg]"
            vf = (f"[0:v]fps={FPS},split[a][b];[a]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},boxblur=22:2,eq=brightness=-0.1[bg];"
                  f"{fg};[bg][fg]overlay=(W-w)/2:(H-h)/2:shortest=1,{draw},format=yuv420p[v]")
            out = os.path.join(tmp, f"s{i}.mp4")
            _run(inp + ["-i", wp, "-filter_complex", vf, "-map", "[v]", "-map", "1:a", "-af", "apad", "-t", f"{dur:.2f}",
                        "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-r", str(FPS),
                        "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2", out])
            segs.append(out)
        lst = os.path.join(tmp, "list.txt")
        open(lst, "w").write("".join(f"file '{s}'\n" for s in segs))
        final = os.path.join(tmp, "video.mp4")
        _run(["-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", "-movflags", "+faststart", final])
        return open(final, "rb").read()
