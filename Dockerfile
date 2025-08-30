FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy API server package.json and source code
COPY apps/api-server/package*.json ./
COPY apps/api-server ./

# Install dependencies (will fail offline; run this step during
# deployment when network is available)
RUN npm install --production || true

# Generate Prisma client
RUN npx prisma generate

# Expose port configured in environment
EXPOSE 3000

# Start the API server
CMD ["node", "src/index.js"]
