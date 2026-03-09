#!/bin/bash
set -e

IMAGE="us-central1-docker.pkg.dev/maikbottrade/analytica-repo/frontend:latest"

# Get token from metadata server
TOKEN=$(curl -sf -H 'Metadata-Flavor: Google' \
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token' \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# Login to Artifact Registry
echo "$TOKEN" | docker login -u oauth2accesstoken --password-stdin us-central1-docker.pkg.dev

# Pull new image
docker pull "$IMAGE"

# Restart container
docker stop frontend 2>/dev/null || true
docker rm   frontend 2>/dev/null || true
docker run -d --name frontend --restart always -p 80:3000 -e HOST=0.0.0.0 "$IMAGE"

# Show status
docker ps --filter name=frontend --format 'STATUS: {{.Status}} | IMAGE: {{.Image}}'
