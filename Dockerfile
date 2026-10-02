# Production Dockerfile for Google Cloud Run
FROM node:24-bookworm-slim

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Set working directory
WORKDIR /app

# Install build dependencies required for native modules (e.g. argon2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests for layer caching
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Purge build dependencies to keep the image lightweight and secure
RUN apt-get purge -y --auto-remove python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Copy application source code
COPY . .

# Defense-in-depth: Ensure no sensitive or local user data files remain in the image
RUN rm -rf .env* data/*.json data/*.tmp gcp-key.json *-key.json gcp*.json

RUN mkdir -p /app/data && chown -R node:node /app/data
USER node

# Expose container port for Cloud Run
EXPOSE 8080

# Start the web server
CMD ["npm", "start"]
