FROM node:20-alpine

WORKDIR /app

COPY app/package*.json ./
RUN npm ci --only=production

COPY app/ .

# Injected by CI — makes the running version visible in the UI
ARG BUILD_VERSION=local
ARG BUILD_TIME
ENV BUILD_VERSION=${BUILD_VERSION}
ENV BUILD_TIME=${BUILD_TIME}

EXPOSE 8080
ENV PORT=8080

CMD ["node", "server.js"]
