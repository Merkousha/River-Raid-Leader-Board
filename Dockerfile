# River Raid Leaderboard
FROM node:20-alpine

# Build deps for better-sqlite3 native module
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# App files
COPY server.js ./
COPY public ./public

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# DB and logs live in /app/data (mount volume for persistence)
CMD ["node", "server.js"]
