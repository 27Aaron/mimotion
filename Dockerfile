# syntax=docker/dockerfile:1

ARG NODE_VERSION=22
ARG RUST_VERSION=1.96

# ---------- 前端：产物与目标架构无关，固定在构建机原生平台执行一次 ----------
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-slim AS frontend
WORKDIR /src
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npm run build:frontend

# ---------- Rust 交叉编译工具链：仅当基础镜像变化时重建 ----------
FROM --platform=$BUILDPLATFORM rust:${RUST_VERSION}-bookworm AS tools
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3-minimal python3-pip \
 && rm -rf /var/lib/apt/lists/* \
 && pip3 install --break-system-packages ziglang==0.14.1 \
 && cargo install --locked cargo-zigbuild cargo-chef \
 && rustup target add x86_64-unknown-linux-gnu aarch64-unknown-linux-gnu

# ---------- 依赖配方：源码变更不会打穿依赖编译缓存层 ----------
FROM tools AS planner
WORKDIR /src/backend
COPY backend/Cargo.toml backend/Cargo.lock ./
RUN cargo chef prepare --recipe-path recipe.json

# ---------- 后端：原生平台执行，按 TARGETPLATFORM 交叉编译，全程无 QEMU ----------
FROM tools AS backend
WORKDIR /src/backend
ARG TARGETPLATFORM
RUN case "${TARGETPLATFORM}" in \
        linux/amd64) echo x86_64-unknown-linux-gnu > /triple ;; \
        linux/arm64) echo aarch64-unknown-linux-gnu > /triple ;; \
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

# ---------- 运行时：只做文件拷贝，无任何模拟执行 ----------
FROM debian:bookworm-slim AS runtime
COPY --from=backend /src/backend/target/*/release/mimotion /usr/local/bin/mimotion
COPY --from=backend /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
ENV MIMOTION_HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_URL=/var/lib/mimotion/mimotion.db
WORKDIR /var/lib/mimotion
EXPOSE 3000
USER 10001:10001
ENTRYPOINT ["/usr/local/bin/mimotion"]
