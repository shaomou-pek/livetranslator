FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY smoke/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY api /app/api
COPY smoke /app/smoke
COPY tests/samples /app/tests/samples

EXPOSE 8765

HEALTHCHECK --interval=20s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8765/', timeout=2)"

CMD ["uvicorn", "smoke.server:app", "--host", "0.0.0.0", "--port", "8765"]
