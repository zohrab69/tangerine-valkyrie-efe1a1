"""JARVIS voice service: POST /speak {"text": "...", "lang": "en"|"fr", "format": "wav"|"mp3"} -> audio.

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

VOICE_DIR = os.environ.get("VOICE_DIR", "/voices")
VOICES = {"en": "en_GB-alan-medium", "fr": "fr_FR-tom-medium"}
MAX_CHARS = 1500
LOCK = threading.Lock()          # one synthesis at a time: keeps memory and CPU low
_loaded = {}


def voice(lang):
    name = VOICES.get(lang, VOICES["en"])
    if name not in _loaded:
        _loaded[name] = PiperVoice.load(os.path.join(VOICE_DIR, name + ".onnx"))
    return _loaded[name]


def synth_wav(text, lang):
    buf = io.BytesIO()
    with LOCK:
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
    for lang in VOICES:      # load both voices at start so the first request is fast
        voice(lang)
    ThreadingHTTPServer(("0.0.0.0", 5000), Handler).serve_forever()
