FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
# Install serve globally for serving static files
RUN npm install -g serve@14.2.5
COPY --from=build /app/dist ./dist
EXPOSE 5173
# Use serve with proper MIME types and SPA fallback
CMD ["serve", "-s", "dist", "-l", "tcp://0.0.0.0:5173", "--single"]
