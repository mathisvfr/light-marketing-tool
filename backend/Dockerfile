FROM node:22-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY prompts ./prompts

EXPOSE 3001
CMD ["npm", "start"]
