# Frontend artifact image: builds the `lms` SPA and ships only its static files.
# The image is never run; the server deploy script copies /artifact out of it.
# Bump the tag and digest together (`.nvmrc` stays on Node 24).
FROM node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS build
WORKDIR /app
ENV CI=true NX_DAEMON=false NX_NO_CLOUD=true
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG APP_REVISION
RUN test -n "$APP_REVISION" \
    && npx nx build lms -c production \
    && test -f dist/apps/lms/browser/index.html \
    && printf '%s\n' "$APP_REVISION" > dist/apps/lms/browser/version.txt

FROM scratch AS artifact
COPY --from=build /app/dist/apps/lms/browser/ /artifact/
