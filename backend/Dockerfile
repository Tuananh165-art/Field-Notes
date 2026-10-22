FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/field-notes-api ./cmd/api

FROM alpine:3.22
RUN addgroup -S app && adduser -S -G app app && apk add --no-cache ca-certificates
USER app
COPY --from=build /out/field-notes-api /usr/local/bin/field-notes-api
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/field-notes-api"]
