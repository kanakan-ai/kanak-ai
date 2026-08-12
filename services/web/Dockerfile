FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Accept API URL as build arg
ARG VITE_API_BASE_URL=http://localhost:8080/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Build production bundle (M1-T1: minimal app)
RUN npm run build

# Install serve for production
RUN npm install -g serve

# Expose web port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Serve built app
CMD ["serve", "-s", "dist", "-l", "3000"]
