# Open Zagora Admin Server Dockerfile
# Enterprise-grade admin backend with complete separation

FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Create upload directories
RUN mkdir -p uploads parsed

# NOTE: For development, we run as root to avoid volume mount permission issues.
# In production, you should use a non-root user. Uncomment below for production:
# RUN addgroup -g 1001 -S adminuser && \
#     adduser -S adminuser -u 1001
# RUN chown -R adminuser:adminuser /app
# USER adminuser

# Expose admin server port (different from main server)
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the admin server
CMD ["node", "server.js"]
