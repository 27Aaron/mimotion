use axum::{
    Json,
    extract::State,
    http::{HeaderMap, Method, StatusCode, header},
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::Arc;

use crate::{
    auth::{self, AuthUser},
    security::rate_limit,
    state::AppState,
};

use super::common::{
    app_error, empty_response, json_error, no_store, rate_limit_headers, request_ip, secure_cookie,
    with_set_cookie,
};

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    username: String,
    password: String,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    username: String,
    password: String,
    #[serde(rename = "inviteCode")]
    invite_code: String,
}

#[derive(Debug, Serialize)]
struct SessionUser {
    id: String,
    username: String,
    #[serde(rename = "isAdmin")]
    is_admin: bool,
}

#[derive(Debug, Serialize)]
struct SessionResponse {
    user: SessionUser,
}

pub async fn login(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<LoginRequest>,
) -> Response {
    if input.username.len() < 2
        || input.username.len() > 32
        || input.password.is_empty()
        || input.password.len() > 128
    {
        return json_error(
            StatusCode::UNAUTHORIZED,
            "用户名或密码错误",
            "INVALID_CREDENTIALS",
        );
    }

    let now = chrono::Utc::now().timestamp_millis();
    let key = format!("login:{}", request_ip(&headers));
    match rate_limit::check(&state.db, &key, 10, 15 * 60 * 1000, now).await {
        Ok(limit) if !limit.allowed => {
            return rate_limit_headers(
                json_error(
                    StatusCode::TOO_MANY_REQUESTS,
                    "请求过于频繁，请稍后再试",
                    "RATE_LIMITED",
                ),
                limit,
            );
        }
        Err(error) => return app_error(error),
        _ => {}
    }

    let user = match sqlx::query(
        "SELECT id, username, password_hash, is_admin FROM users WHERE username = ? LIMIT 1",
    )
    .bind(&input.username)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => {
            return json_error(
                StatusCode::UNAUTHORIZED,
                "用户名或密码错误",
                "INVALID_CREDENTIALS",
            );
        }
        Err(error) => return app_error(error),
    };

    let password_hash: String = match user.try_get("password_hash") {
        Ok(value) => value,
        Err(error) => return app_error(error),
    };
    match auth::verify_password(input.password, password_hash).await {
        Ok(true) => {}
        Ok(false) => {
            return json_error(
                StatusCode::UNAUTHORIZED,
                "用户名或密码错误",
                "INVALID_CREDENTIALS",
            );
        }
        Err(error) => return app_error(error),
    }

    let user = match sqlx::query_as::<_, crate::storage::models::UserRow>(
        "SELECT id, username, password_hash, is_admin, locale, bark_url, bark_url_data, bark_url_iv, telegram_bot_token, telegram_bot_token_data, telegram_bot_token_iv, telegram_chat_id, created_at, updated_at FROM users WHERE username = ? LIMIT 1",
    )
    .bind(&input.username)
    .fetch_one(&state.db)
    .await
    {
        Ok(user) => user,
        Err(error) => return app_error(error),
    };
    let token = match auth::create_token(&state.config, &user) {
        Ok(token) => token,
        Err(error) => return app_error(error),
    };

    let response = no_store(SessionResponse {
        user: SessionUser {
            id: user.id,
            username: user.username,
            is_admin: user.is_admin.unwrap_or_default() != 0,
        },
    });
    with_set_cookie(response, auth::session_cookie(&token, secure_cookie()))
}

pub async fn register(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<RegisterRequest>,
) -> Response {
    if input.username.len() < 2 || input.username.len() > 32 {
        return json_error(
            StatusCode::BAD_REQUEST,
            "用户名长度需在 2-32 之间",
            "USERNAME_LENGTH",
        );
    }
    if input.password.len() < 8
        || input.password.len() > 128
        || !input
            .password
            .chars()
            .any(|char| char.is_ascii_alphabetic())
        || !input.password.chars().any(|char| char.is_ascii_digit())
    {
        return json_error(
            StatusCode::BAD_REQUEST,
            "密码需包含字母和数字",
            "PASSWORD_COMPLEXITY",
        );
    }
    if !is_invite_code(&input.invite_code) {
        return json_error(StatusCode::BAD_REQUEST, "邀请码无效", "INVALID_CODE");
    }

    let now = chrono::Utc::now().timestamp_millis();
    let key = format!("register:{}", request_ip(&headers));
    match rate_limit::check(&state.db, &key, 5, 60 * 60 * 1000, now).await {
        Ok(limit) if !limit.allowed => {
            return rate_limit_headers(
                json_error(
                    StatusCode::TOO_MANY_REQUESTS,
                    "注册请求过于频繁，请稍后再试",
                    "RATE_LIMITED",
                ),
                limit,
            );
        }
        Err(error) => return app_error(error),
        _ => {}
    }

    let password_hash = match auth::hash_password(input.password).await {
        Ok(value) => value,
        Err(error) => return app_error(error),
    };
    let user_id = uuid::Uuid::new_v4().to_string();
    let invite_code = input.invite_code.to_ascii_uppercase();
    let mut transaction = match state.db.begin().await {
        Ok(transaction) => transaction,
        Err(error) => return app_error(error),
    };

    let code = match sqlx::query("SELECT used_by FROM invite_codes WHERE code = ? LIMIT 1")
        .bind(&invite_code)
        .fetch_optional(&mut *transaction)
        .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return json_error(StatusCode::BAD_REQUEST, "邀请码无效", "INVALID_CODE"),
        Err(error) => return app_error(error),
    };
    let used_by: Option<String> = match code.try_get("used_by") {
        Ok(value) => value,
        Err(error) => return app_error(error),
    };
    if used_by.is_some() {
        return json_error(StatusCode::BAD_REQUEST, "邀请码已使用", "CODE_USED");
    }

    let username_exists = match sqlx::query("SELECT 1 FROM users WHERE username = ? LIMIT 1")
        .bind(&input.username)
        .fetch_optional(&mut *transaction)
        .await
    {
        Ok(value) => value.is_some(),
        Err(error) => return app_error(error),
    };
    if username_exists {
        return json_error(StatusCode::BAD_REQUEST, "用户名已被使用", "USERNAME_TAKEN");
    }

    if let Err(error) = sqlx::query(
        "INSERT INTO users (id, username, password_hash, is_admin, locale, created_at, updated_at) VALUES (?, ?, ?, 0, 'zh', ?, ?)",
    )
    .bind(&user_id)
    .bind(&input.username)
    .bind(&password_hash)
    .bind(now)
    .bind(now)
    .execute(&mut *transaction)
    .await
    {
        return app_error(error);
    }

    let claimed =
        match sqlx::query("UPDATE invite_codes SET used_by = ? WHERE code = ? AND used_by IS NULL")
            .bind(&user_id)
            .bind(&invite_code)
            .execute(&mut *transaction)
            .await
        {
            Ok(result) => result.rows_affected(),
            Err(error) => return app_error(error),
        };
    if claimed != 1 {
        return json_error(
            StatusCode::CONFLICT,
            "邀请码领取失败，请重试",
            "INVITE_CLAIM_FAILED",
        );
    }

    if let Err(error) = transaction.commit().await {
        return app_error(error);
    }

    let user = crate::storage::models::UserRow {
        id: user_id.clone(),
        username: input.username.clone(),
        password_hash,
        is_admin: Some(0),
        locale: Some("zh".to_owned()),
        bark_url: None,
        bark_url_data: None,
        bark_url_iv: None,
        telegram_bot_token: None,
        telegram_bot_token_data: None,
        telegram_bot_token_iv: None,
        telegram_chat_id: None,
        created_at: now,
        updated_at: now,
    };
    let token = match auth::create_token(&state.config, &user) {
        Ok(token) => token,
        Err(error) => return app_error(error),
    };
    let response = no_store(SessionResponse {
        user: SessionUser {
            id: user_id,
            username: input.username,
            is_admin: false,
        },
    });
    with_set_cookie(response, auth::session_cookie(&token, secure_cookie()))
}

pub async fn logout(
    method: Method,
    State(_state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Response {
    let response = if method == Method::GET {
        let locale = auth::cookie_value(&headers, "NEXT_LOCALE")
            .filter(|value| *value == "zh" || *value == "en")
            .unwrap_or("zh");
        Response::builder()
            .status(StatusCode::FOUND)
            .header(header::LOCATION, format!("/{locale}/login"))
            .body(axum::body::Body::empty())
            .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
    } else {
        empty_response(StatusCode::NO_CONTENT)
    };
    with_set_cookie(response, auth::expired_session_cookie(secure_cookie()))
}

pub async fn me(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    let Some(user) = auth::current_user(&state.config, &state.db, &headers).await else {
        return json_error(StatusCode::UNAUTHORIZED, "Token 无效", "TOKEN_INVALID");
    };
    no_store(SessionResponse {
        user: SessionUser {
            id: user.id,
            username: user.username,
            is_admin: user.is_admin,
        },
    })
}

fn is_invite_code(value: &str) -> bool {
    value.len() == 8 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

#[allow(dead_code)]
fn _auth_user_is_used(user: &AuthUser) -> bool {
    !user.id.is_empty()
}
