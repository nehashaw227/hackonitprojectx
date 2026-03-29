# ----- Stage 1: Build the Vite App -----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ----- Stage 2: Production Server -----
FROM node:20-alpine AS runner

WORKDIR /app

# Set env to production so server.js knows to serve static files
ENV NODE_ENV=production

COPY package*.json ./
# Install only production dependencies for the Express server
RUN npm ci --omit=dev

# Copy only the compiled UI and the Express backend file
COPY --from=builder /app/dist ./dist
COPY server.js ./

EXPOSE 3000

CMD ["node", "server.js"]
