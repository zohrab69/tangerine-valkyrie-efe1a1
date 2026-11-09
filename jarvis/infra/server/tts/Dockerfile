# JARVIS voice: Piper text-to-speech (open source, runs offline on this server, free, no limits).
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir piper-tts==1.8.0
# Voices are downloaded once, at build time, from the official Piper voice repository.
#   English: British male "alan";  French: male "tom"
RUN mkdir /voices && python -m piper.download_voices en_GB-alan-medium fr_FR-tom-medium --download-dir /voices
COPY server.py /app/server.py
RUN useradd -r -u 10001 tts
USER tts
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:5000/health',timeout=3)"
CMD ["python", "/app/server.py"]
