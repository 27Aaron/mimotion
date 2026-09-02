# syntax=docker/dockerfile:1

ARG NODE_VERSION=22
ARG RUST_VERSION=1.96
ARG ALPINE_VERSION=3

FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-slim AS frontend
WORKDIR /src
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npm run build:frontend

FROM --platform=$BUILDPLATFORM rust:${RUST_VERSION}-bookworm AS tools
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3-minimal python3-pip \
 && rm -rf /var/lib/apt/lists/* \
 && pip3 install --break-system-packages ziglang==0.14.1 \
 && cargo install --locked cargo-zigbuild cargo-chef \
 && rustup target add x86_64-unknown-linux-musl aarch64-unknown-linux-musl

FROM tools AS planner
WORKDIR /src/backend
COPY backend/Cargo.toml backend/Cargo.lock ./
RUN cargo chef prepare --recipe-path recipe.json

FROM tools AS backend
WORKDIR /src/backend
ARG TARGETPLATFORM
RUN case "${TARGETPLATFORM}" in \
        linux/amd64) echo x86_64-unknown-linux-musl > /triple ;; \
        linux/arm64) echo aarch64-unknown-linux-musl > /triple ;; \
        *) echo "unsupported platform: ${TARGETPLATFORM}" >&2; exit 1 ;; \
    esac
COPY --from=planner /src/backend/recipe.json ./
RUN --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
    cargo chef cook --release --zigbuild --target "$(cat /triple)" --recipe-path recipe.json
COPY backend/Cargo.toml backend/Cargo.lock ./
COPY backend/migrations ./migrations
COPY backend/src ./src
COPY --from=frontend /src/frontend/dist /src/frontend/dist
RUN --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
    cargo zigbuild --release --locked --target "$(cat /triple)"

FROM alpine:${ALPINE_VERSION} AS runtime
RUN apk add --no-cache su-exec
COPY --from=backend /src/backend/target/*/release/mimotion /usr/local/bin/mimotion
COPY --from=backend /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/entrypoint.sh
ENV MIMOTION_HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_URL=/var/lib/mimotion/mimotion.db \
    DATA_DIR=/var/lib/mimotion
WORKDIR /var/lib/mimotion
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
