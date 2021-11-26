# Copyright (C) 2021 Edge Network Technologies Limited
# Use of this source code is governed by a GNU GPL-style license
# that can be found in the LICENSE.md file. All rights reserved.

FROM node:14

ARG targetNode=node14

ARG targetNetwork

RUN npm i -g pkg pkg-fetch

ENV BUILD_TARGET=alpine-x64
ENV BIN_NAME=edge
ENV NETWORK=

WORKDIR /build

COPY package.json package-lock.json tsconfig.json /build

RUN npm i

RUN echo "npm run \${NETWORK}:build:src &&\\" > /usr/local/bin/build-cli
RUN echo "pkg out/src/main-\${NETWORK}.js -t ${targetNode}-\${BUILD_TARGET} --output /build/bin/\${BIN_NAME}" >> /usr/local/bin/build-cli

RUN chmod +x /usr/local/bin/build-cli

CMD ["build-cli"]
