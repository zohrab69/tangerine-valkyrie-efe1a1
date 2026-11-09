# syntax=docker/dockerfile:1
# JARVIS voice, free and offline on this server:
#   English: Kokoro (natural, human-like; Apache-2.0 model)   French: Piper (male "tom")
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir piper-tts==1.8.0 kokoro-onnx==0.6.1
RUN mkdir /voices && python -m piper.download_voices en_GB-alan-medium fr_FR-tom-medium --download-dir /voices
# Kokoro model (quantized, ~90 MB) + voice pack (~28 MB), official kokoro-onnx release files
ADD --chmod=644 https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx /voices/kokoro.onnx
ADD --chmod=644 https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin /voices/kokoro-voices.bin
COPY server.py /app/server.py
RUN useradd -r -u 10001 tts
USER tts
ENV JARVIS_VOICE=am_adam
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:5000/health',timeout=3)"
CMD ["python", "/app/server.py"]
