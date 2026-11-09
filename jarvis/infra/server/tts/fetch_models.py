"""Download the Kokoro model files at build time, retrying (GitHub's download servers sometimes time out)."""
import os, sys, time, urllib.request

BASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/"
FILES = {  # target -> (candidate URLs, minimum size in bytes)
    "/voices/kokoro.onnx": ([BASE + "model-files-v1.0/kokoro-v1.0.int8.onnx"], 50_000_000),
    "/voices/kokoro-voices.bin": ([BASE + "model-files-v1.0/voices-v1.0.bin", BASE + "model-files-v1.1/voices-v1.0.bin"], 20_000_000),
}
for target, (urls, min_size) in FILES.items():
    ok = False
    for attempt in range(1, 9):
        url = urls[(attempt - 1) % len(urls)]
        try:
            tmp = target + ".part"
            with urllib.request.urlopen(url, timeout=120) as r, open(tmp, "wb") as f:
                while chunk := r.read(1 << 20):
                    f.write(chunk)
            if os.path.getsize(tmp) < min_size:
                raise IOError("file too small")
            os.replace(tmp, target)
            os.chmod(target, 0o644)
            print(f"downloaded {os.path.basename(target)} ({os.path.getsize(target) // 1_000_000} MB)", flush=True)
            ok = True
            break
        except Exception as e:
            wait = min(60, 5 * attempt)
            print(f"attempt {attempt} for {os.path.basename(target)} failed ({type(e).__name__}); retrying in {wait}s", flush=True)
            time.sleep(wait)
    if not ok:
        sys.exit("could not download " + target)
