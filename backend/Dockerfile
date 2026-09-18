FROM node:22-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY prompts ./prompts

# Run as non-root user for security
RUN mkdir -p /app/uploads && chown -R node:node /app

# su-exec for dropping privileges in entrypoint; entrypoint runs as root
# briefly to fix volume ownership, then drops to node.
RUN apk add --no-cache su-exec
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["/app/entrypoint.sh"]
