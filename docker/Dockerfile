# syntax=docker/dockerfile:experimental

FROM node:20

RUN apt-get update && apt-get install -y curl nano git
RUN apt-get update -qq
RUN apt-get install openssh-client -y

# RUN npm install -g yarn

WORKDIR /home/chart

RUN git clone https://github.com/digitalfuture/crypto-bot-surfer-ui.git . \
    && yarn install && yarn build

EXPOSE 8081

CMD ["yarn", "start"]
