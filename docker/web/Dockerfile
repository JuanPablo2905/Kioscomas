FROM node:24-slim AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
ARG PUBLIC_API_URL
ARG BUILD_SCRIPT=build:cloud-app
ARG OUT_DIR=dist-cloud-app
ENV VITE_PUBLIC_API_URL=$PUBLIC_API_URL
RUN pnpm run $BUILD_SCRIPT && mkdir /out && cp -r $OUT_DIR/. /out/

FROM nginx:1.27-alpine
COPY docker/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /out /usr/share/nginx/html
