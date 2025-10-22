# Use Node.js 20 LTS
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy root package.json
COPY package.json ./

# Copy server package.json and install dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --only=production

# Copy server source code
COPY server/ ./

# Create data directories
RUN mkdir -p data/downloads data/processed

# Expose port (Railway will set PORT environment variable)
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
