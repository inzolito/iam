# Backend Dockerfile
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application
COPY . .

# Use shell form for CMD to allow environment variable expansion
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}
