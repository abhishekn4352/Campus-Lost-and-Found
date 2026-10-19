FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
# Uploaded photos live on a volume so they survive container restarts.
RUN mkdir -p /data/uploads && chown -R node:node /app /data
ENV UPLOAD_DIR=/data/uploads
VOLUME ["/data/uploads"]

USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD wget -qO- http://127.0.0.1:5000/api/health || exit 1
CMD ["node", "server.js"]
