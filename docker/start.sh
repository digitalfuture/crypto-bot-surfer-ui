#!/bin/bash

docker stop chart-container
docker rm chart-container --force
docker rmi chart-image --force

docker build -t chart-image . --no-cache

# build run via name: chart-server
docker run \
    -p 80:80 \
    --name chart-container \
    -v /root/mytest/report:/home/chart/public/data \
    -d chart-image