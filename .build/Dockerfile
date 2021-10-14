FROM node:14

ARG targetNode=node14

RUN npm i -g pkg pkg-fetch

ENV BUILD_TARGET=alpine-x64

WORKDIR /build

COPY package.json package-lock.json tsconfig.json /build

RUN npm i

RUN echo 'npm run build:src &&\\' > /usr/local/bin/build-cli
RUN echo "pkg out/src/main.js -t ${targetNode}-\${BUILD_TARGET} --output /build/bin/edge" >> /usr/local/bin/build-cli

RUN chmod +x /usr/local/bin/build-cli

CMD ["build-cli"]
