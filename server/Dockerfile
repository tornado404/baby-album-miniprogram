FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir --default-timeout 600 \
    fastapi uvicorn[standard] sqlalchemy asyncpg pydantic \
    pydantic-settings pyjwt redis httpx pillow python-multipart minio

COPY app/ app/
COPY scripts/ scripts/

RUN useradd -m app 2>/dev/null; chown -R app:app /app
USER app

EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--loop", "asyncio"]