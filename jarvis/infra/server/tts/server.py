"""JARVIS voice service: POST /speak {"text": "...", "lang": "en"|"fr", "format": "wav"|"mp3"} -> audio.

English uses Kokoro (human-like), French uses Piper. If Kokoro cannot load, English falls back to Piper.
Voice: env JARVIS_VOICE (Kokoro voice id, e.g. bm_george, bm_lewis, am_michael). Speed: env JARVIS_SPEED.
Internal only (Docker network + password-protected JARVIS site). No external calls at runtime.
"""
import io
import json
import os
import subprocess
import threading
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from piper import PiperVoice, SynthesisConfig

try:
    import numpy as np
    import onnxruntime as rt
    from kokoro_onnx import Kokoro
except Exception:  # Kokoro not installed: Piper only
    Kokoro = None

VOICE_DIR = os.environ.get("VOICE_DIR", "/voices")
VOICES = {"en": "en_GB-alan-medium", "fr": "fr_FR-tom-medium"}
MAX_CHARS = 1500
LOCK = threading.Lock()          # one synthesis at a time: keeps memory and CPU low
_loaded = {}
KOKORO_VOICE = os.environ.get("JARVIS_VOICE", "am_adam")
SPEED = float(os.environ.get("JARVIS_SPEED", "1.05"))
_kokoro = None


def kokoro():
    global _kokoro
    if _kokoro is None and Kokoro is not None:
        try:
            so = rt.SessionOptions()
            so.intra_op_num_threads = 2
            sess = rt.InferenceSession(os.path.join(VOICE_DIR, "kokoro.onnx"), so, providers=["CPUExecutionProvider"])
            _kokoro = Kokoro.from_session(sess, os.path.join(VOICE_DIR, "kokoro-voices.bin"))
        except Exception as e:
            print("Kokoro unavailable, using Piper:", type(e).__name__, flush=True)
            _kokoro = False
    return _kokoro or None


def voice(lang):
    name = VOICES.get(lang, VOICES["en"])
    if name not in _loaded:
        _loaded[name] = PiperVoice.load(os.path.join(VOICE_DIR, name + ".onnx"))
    return _loaded[name]


def synth_wav(text, lang):
    buf = io.BytesIO()
    with LOCK:
        k = kokoro() if lang == "en" else None
        if k:
            audio, sr = k.create(text, voice=KOKORO_VOICE, speed=SPEED,
                                 lang="en-gb" if KOKORO_VOICE.startswith("b") else "en-us")
            with wave.open(buf, "wb") as wav:
                wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(sr)
                wav.writeframes((np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes())
        else:
            v = voice(lang)
            with wave.open(buf, "wb") as wav:
                v.synthesize_wav(text, wav, syn_config=SynthesisConfig(length_scale=0.88))
    return buf.getvalue()


def to_mp3(wav_bytes):
    out = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "wav", "-i", "pipe:0",
         "-codec:a", "libmp3lame", "-q:a", "5", "-f", "mp3", "pipe:1"],
        input=wav_bytes, capture_output=True, check=True, timeout=60)
    return out.stdout


class Handler(BaseHTTPRequestHandler):
    server_version = "jarvis-tts"

    def _send(self, code, body, ctype):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.rstrip("/") in ("/health", "/api/speak/health"):
            self._send(200, b'{"status":"ok"}', "application/json")
        else:
            self._send(404, b"not found", "text/plain")

    def do_POST(self):
        if self.path.rstrip("/") not in ("/speak", "/api/speak"):
            return self._send(404, b"not found", "text/plain")
        try:
            n = int(self.headers.get("Content-Length") or 0)
            if n > 20000:
                return self._send(413, b"too large", "text/plain")
            req = json.loads(self.rfile.read(n) or b"{}")
            text = " ".join(str(req.get("text", "")).split())[:MAX_CHARS]
            if not text:
                return self._send(400, b"text is required", "text/plain")
            lang = "fr" if str(req.get("lang", "en")).lower().startswith("fr") else "en"
            wav_bytes = synth_wav(text, lang)
            if str(req.get("format", "wav")).lower() == "mp3":
                return self._send(200, to_mp3(wav_bytes), "audio/mpeg")
            return self._send(200, wav_bytes, "audio/wav")
        except Exception as e:  # report, never crash the service
            return self._send(500, ("error: " + type(e).__name__).encode(), "text/plain")

    def log_message(self, fmt, *args):  # keep logs short; never log the spoken text
        pass


if __name__ == "__main__":
    for lang in VOICES:      # load voices at start so the first request is fast
        try:
            voice(lang)
        except Exception as e:
            print("Piper voice", lang, "unavailable:", type(e).__name__, flush=True)
    if kokoro():
        synth_wav("Ready.", "en")   # warm-up
    print("JARVIS voice ready:", ("Kokoro " + KOKORO_VOICE) if kokoro() else "Piper", flush=True)
    ThreadingHTTPServer(("0.0.0.0", 5000), Handler).serve_forever()
