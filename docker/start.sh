#!/bin/bash

docker stop chart-container
docker rm chart-container --force
docker rmi chart-image --force

docker build -t chart-image . --no-cache

# build run via name: chart-container
docker run \
    -p 80:8081 \
    --name chart-container \
    -v /home/report:/home/chart/public/data \
    -d chart-image