# Stage 1: Build the app using a Node.js image
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock/pnpm-lock.yaml)
# and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Run the production build command
RUN npm run build

# Stage 2: Serve the static files with Nginx
FROM nginx:alpine

# Serving config: gzip_static, cache headers and the model/wasm MIME types
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built files from the builder stage to the Nginx web directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80 (default Nginx port)
EXPOSE 80

# Command to start the Nginx server
CMD ["nginx", "-g", "daemon off;"]
