#!/bin/bash

# Ensure script runs from its directory
cd "$(dirname "$0")"

docker stop chart-container 2>/dev/null || true
docker rm chart-container --force 2>/dev/null || true

docker build --build-arg CACHEBUST=$(date +%s) -t chart-image .

# build run via name: chart-container
docker run \
    -p 80:8081 \
    --name chart-container \
    -v /home/report:/home/chart/public/data \
    --restart unless-stopped \
    -d chart-image