use std::sync::Arc;

use axum::{
    Router,
    body::Body,
    extract::State,
    http::{HeaderValue, Method, StatusCode, Uri, header},
    middleware,
    response::{IntoResponse, Response},
    routing::get,
};
use mime_guess::from_path;
use rust_embed::Embed;
use serde::Serialize;
use tower_http::{compression::CompressionLayer, trace::TraceLayer};

use crate::state::AppState;

mod admin;
mod auth;
mod common;
mod dashboard;
mod invites;
mod schedules;
mod settings;
mod xiaomi;

#[derive(Embed)]
#[folder = "../frontend/dist/"]
#[allow_missing = true]
struct Assets;

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
    version: &'static str,
}

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/api/health", get(health))
        .route("/api/auth/login", axum::routing::post(auth::login))
        .route("/api/auth/register", axum::routing::post(auth::register))
        .route(
            "/api/auth/logout",
            axum::routing::get(auth::logout).post(auth::logout),
        )
        .route("/api/auth/me", get(auth::me))
        .route("/api/dashboard", get(dashboard::get))
        .route(
            "/api/invite",
            axum::routing::get(invites::list)
                .post(invites::create)
                .delete(invites::delete),
        )
        .route(
            "/api/schedules",
            axum::routing::get(schedules::list)
                .post(schedules::create)
                .put(schedules::update)
                .delete(schedules::delete),
        )
        .route(
            "/api/user/settings",
            axum::routing::get(settings::get).put(settings::update),
        )
        .route(
            "/api/user/test-push",
            axum::routing::post(settings::test_push),
        )
        .route(
            "/api/xiaomi",
            axum::routing::get(xiaomi::list)
                .post(xiaomi::create)
                .put(xiaomi::update)
                .delete(xiaomi::delete),
        )
        .route(
            "/api/admin/users",
            axum::routing::get(admin::list)
                .put(admin::reset_password)
                .delete(admin::delete),
        )
        .fallback(static_or_not_found)
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http())
        .layer(middleware::map_response(add_security_headers))
        .with_state(state)
}

async fn add_security_headers(mut response: Response) -> Response {
    let headers = response.headers_mut();
    headers.insert("x-frame-options", HeaderValue::from_static("DENY"));
    headers.insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        "referrer-policy",
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
    headers.insert(
        "permissions-policy",
        HeaderValue::from_static("camera=(), microphone=(), geolocation=()"),
    );
    response
}

async fn health(State(_state): State<Arc<AppState>>) -> impl IntoResponse {
    axum::Json(HealthResponse {
        status: "ok",
        service: "mimotion",
        version: env!("CARGO_PKG_VERSION"),
    })
}

async fn static_or_not_found(method: Method, uri: Uri) -> Response {
    if !matches!(method, Method::GET | Method::HEAD) {
        return StatusCode::METHOD_NOT_ALLOWED.into_response();
    }

    if uri.path().starts_with("/api/") {
        return (
            StatusCode::NOT_FOUND,
            axum::Json(serde_json::json!({
                "error": { "code": "NOT_FOUND", "message": "API 路由不存在" }
            })),
        )
            .into_response();
    }

    let requested = uri.path().trim_start_matches('/');
    let asset_path = if requested.is_empty() {
        Some("index.html")
    } else if Assets::get(requested).is_some() {
        Some(requested)
    } else if is_spa_route(requested) {
        Some("index.html")
    } else {
        None
    };

    let Some(asset_path) = asset_path else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let Some(asset) = Assets::get(asset_path) else {
        return StatusCode::NOT_FOUND.into_response();
    };

    let content_type = from_path(asset_path)
        .first_or_octet_stream()
        .as_ref()
        .parse::<HeaderValue>()
        .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream"));
    let cache_control = if asset_path == "index.html" {
        HeaderValue::from_static("no-cache")
    } else {
        HeaderValue::from_static("public, max-age=31536000, immutable")
    };
    let body = if method == Method::HEAD {
        Body::empty()
    } else {
        Body::from(asset.data.into_owned())
    };

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CACHE_CONTROL, cache_control)
        .body(body)
        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}

fn is_spa_route(path: &str) -> bool {
    !path.starts_with("assets/") && !path.rsplit('/').next().unwrap_or_default().contains('.')
}
