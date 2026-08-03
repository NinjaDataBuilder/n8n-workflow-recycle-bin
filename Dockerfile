FROM node:22-alpine

ARG RELEASE_VERSION=dev

RUN apk add --no-cache su-exec

WORKDIR /app

COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node app ./app
COPY docker-entrypoint.sh /usr/local/bin/workflow-recycle-bin-entrypoint

RUN chmod 0555 /usr/local/bin/workflow-recycle-bin-entrypoint \
  && mkdir -p /data \
  && chown node:node /data

ENV NODE_ENV=production
ENV PORT=3000
ENV RECYCLE_BIN_AUDIT_STORE_PATH=/data/audit.json

LABEL org.opencontainers.image.title="Workflow Recycle Bin" \
      org.opencontainers.image.description="Guarded recycle bin sidecar for self-hosted n8n" \
      org.opencontainers.image.version="${RELEASE_VERSION}" \
      org.opencontainers.image.source="https://github.com/NinjaDataBuilder/n8n-workflow-recycle-bin"

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:3000/health >/dev/null || exit 1

STOPSIGNAL SIGTERM
USER root
ENTRYPOINT ["/usr/local/bin/workflow-recycle-bin-entrypoint"]
