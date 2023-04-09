# syntax=docker/dockerfile:experimental

FROM node:19

RUN apt-get update && apt-get install -y curl nano git
RUN apt-get update -qq
RUN apt-get install openssh-client -y
RUN mkdir /home/chart && cd /home/chart \ 
    && git clone https://github.com/digitalfuture/crypto-bot-surfer-ui.git . \
    && npm i && npm run build

EXPOSE 80

WORKDIR /home/chart

CMD ["npm", "run", "start"]
