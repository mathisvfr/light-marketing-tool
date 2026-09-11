FROM node:22-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY prompts ./prompts

# Run as non-root user for security
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

EXPOSE 3001
CMD ["npm", "start"]
