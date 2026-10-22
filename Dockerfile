FROM n8nio/n8n:2.44.5@sha256:bcb4e4917141f4a5249c8eadf2776d347f4c2ede75adfbbc82064826af9a8ead AS n8n_native

FROM node:22.23.4-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS adapter_2445
WORKDIR /build
COPY scripts/generate-n8n-2445-adapter.mjs ./generate.mjs
COPY --from=n8n_native /usr/local/lib/node_modules/n8n/node_modules/.pnpm/n8n-editor-ui*/node_modules/n8n-editor-ui/dist/assets/app-0aL7xNtl.js /native/
COPY --from=n8n_native /usr/local/lib/node_modules/n8n/node_modules/.pnpm/n8n-editor-ui*/node_modules/n8n-editor-ui/dist/assets/AppSidebar-DqEHFut7.js /native/
COPY --from=n8n_native /usr/local/lib/node_modules/n8n/node_modules/.pnpm/n8n-editor-ui*/node_modules/n8n-editor-ui/dist/assets/WorkflowsView-DXcBW1OL.js /native/
COPY --from=n8n_native /usr/local/lib/node_modules/n8n/node_modules/.pnpm/n8n-editor-ui*/node_modules/n8n-editor-ui/dist/assets/vendor-COD0pq0C.js /native/
RUN node generate.mjs /native /generated

FROM node:22.23.4-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914

ARG RELEASE_VERSION=dev

RUN apk add --no-cache su-exec

WORKDIR /app

COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node app ./app
COPY --from=adapter_2445 --chown=node:node /generated/ ./app/public/assets/
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
