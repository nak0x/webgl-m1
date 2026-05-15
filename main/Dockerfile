FROM node:23-alpine AS builder

WORKDIR /app

RUN apk add --no-cache aws-cli

COPY package*.json ./
RUN npm install

COPY . .

RUN AWS_ACCESS_KEY_ID=dummy AWS_SECRET_ACCESS_KEY=dummy \
    aws s3 sync s3://assets/models/ public/models/ \
      --endpoint-url $MINIO_ENDPOINT \
      --no-sign-request && \
    aws s3 sync s3://assets/sounds/ public/sounds/ \
      --endpoint-url $MINIO_ENDPOINT \
      --no-sign-request && \
    aws s3 sync s3://assets/videos/ public/videos/ \
      --endpoint-url $MINIO_ENDPOINT \
      --no-sign-request

RUN npm run build

FROM node:23-alpine
WORKDIR /app
COPY --from=builder /app/.output ./.output

ENV HOST=0.0.0.0
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]