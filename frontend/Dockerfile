# Stage 1: Build con Node
FROM node:14-alpine AS build
WORKDIR /app
ARG REACT_APP_API_URL=http://localhost:8080/api
ENV REACT_APP_API_URL=$REACT_APP_API_URL
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Servir con nginx
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
