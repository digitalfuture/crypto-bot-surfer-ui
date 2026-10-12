# syntax=docker/dockerfile:experimental

FROM node:20

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl nano git openssh-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /home/chart

ENV NODE_ENV=production

RUN git clone https://github.com/digitalfuture/crypto-bot-surfer-ui.git . \
    && yarn install && yarn build \
    && mkdir -p /home/chart/public/data

EXPOSE 8081

CMD ["yarn", "start"]
