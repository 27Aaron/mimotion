use axum::{
    Json,
    body::Body,
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};
use serde::Serialize;

use crate::{
    auth::{self, AuthUser},
    security::rate_limit::RateLimit,
    state::AppState,
};
use std::sync::Arc;

pub fn json_error(status: StatusCode, message: impl Into<String>, code: &'static str) -> Response {
    (
        status,
        Json(serde_json::json!({
            "error": message.into(),
            "code": code,
        })),
    )
        .into_response()
}

pub fn no_store<T: Serialize>(payload: T) -> Response {
    let mut response = Json(payload).into_response();
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response
}

pub fn with_set_cookie(mut response: Response, cookie: String) -> Response {
    if let Ok(value) = HeaderValue::from_str(&cookie) {
        response.headers_mut().insert(header::SET_COOKIE, value);
    }
    response
}

pub fn secure_cookie() -> bool {
    match std::env::var("AUTH_COOKIE_SECURE")
        .ok()
        .map(|value| value.trim().to_ascii_lowercase())
        .as_deref()
    {
        Some("false") => false,
        Some("true") => true,
        _ => std::env::var("NODE_ENV").is_ok_and(|value| value == "production"),
    }
}

pub fn request_ip(headers: &HeaderMap) -> String {
    headers
        .get("x-forwarded-for")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(',').next())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("unknown")
        .to_owned()
}

pub fn rate_limit_headers(mut response: Response, limit: RateLimit) -> Response {
    if let Ok(value) = HeaderValue::from_str(&limit.remaining.to_string()) {
        response
            .headers_mut()
            .insert("x-ratelimit-remaining", value);
    }
    if let Ok(value) = HeaderValue::from_str(&(limit.reset_at / 1000).to_string()) {
        response.headers_mut().insert("x-ratelimit-reset", value);
    }
    response
}

pub fn empty_response(status: StatusCode) -> Response {
    Response::builder()
        .status(status)
        .body(Body::empty())
        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}

pub fn app_error(error: impl std::fmt::Display) -> Response {
    tracing::error!(%error, event = "request_failed");
    json_error(
        StatusCode::INTERNAL_SERVER_ERROR,
        "服务内部错误",
        "INTERNAL_ERROR",
    )
}

pub async fn require_user(
    state: &Arc<AppState>,
    headers: &HeaderMap,
) -> Result<AuthUser, Response> {
    auth::current_user(&state.config, &state.db, headers)
        .await
        .ok_or_else(|| json_error(StatusCode::UNAUTHORIZED, "未登录", "AUTH_REQUIRED"))
}

pub async fn require_admin(
    state: &Arc<AppState>,
    headers: &HeaderMap,
) -> Result<AuthUser, Response> {
    let user = require_user(state, headers).await?;
    if !user.is_admin {
        return Err(json_error(
            StatusCode::FORBIDDEN,
            "需要管理员权限",
            "ADMIN_REQUIRED",
        ));
    }
    Ok(user)
}
