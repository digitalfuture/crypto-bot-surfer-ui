#!/bin/bash
docker stop chart-container
docker rm chart-container --force
docker rmi chart-image --force

bash build.sh
