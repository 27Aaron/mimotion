use std::sync::Arc;

use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode},
    response::Response,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;

use crate::{
    auth,
    notifications::{self, PushMessage},
    security::crypto,
    state::AppState,
    storage::models::UserRow,
};

use super::common::{
    app_error, json_error, no_store, require_user, secure_cookie, with_set_cookie,
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SettingsResponse {
    id: String,
    username: String,
    #[serde(rename = "isAdmin")]
    is_admin: bool,
    locale: String,
    bark_url: Option<String>,
    telegram_bot_token: Option<String>,
    telegram_chat_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSettingsRequest {
    username: Option<String>,
    password: Option<String>,
    current_password: Option<String>,
    bark_url: Option<Option<String>>,
    telegram_bot_token: Option<Option<String>>,
    telegram_chat_id: Option<Option<String>>,
    locale: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestPushRequest {
    r#type: String,
    bark_url: Option<String>,
    telegram_bot_token: Option<String>,
    telegram_chat_id: Option<String>,
}

pub async fn get(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let row = match fetch_user(&state, &user.id).await {
        Ok(Some(row)) => row,
        Ok(None) => return json_error(StatusCode::UNAUTHORIZED, "Token 无效", "TOKEN_INVALID"),
        Err(error) => return app_error(error),
    };
    let secrets = match notifications::get_user_secrets(&state.config, &state.db, &user.id).await {
        Ok(secrets) => secrets,
        Err(error) => return app_error(error),
    };

    no_store(SettingsResponse {
        id: row.id,
        username: row.username,
        is_admin: row.is_admin.unwrap_or_default() != 0,
        locale: row.locale.unwrap_or_else(|| "zh".to_owned()),
        bark_url: secrets.bark_url,
        telegram_bot_token: secrets.telegram_bot_token,
        telegram_chat_id: secrets.telegram_chat_id,
    })
}

pub async fn update(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<UpdateSettingsRequest>,
) -> Response {
    let current = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let existing = match fetch_user(&state, &current.id).await {
        Ok(Some(row)) => row,
        Ok(None) => return json_error(StatusCode::UNAUTHORIZED, "Token 无效", "TOKEN_INVALID"),
        Err(error) => return app_error(error),
    };

    let username = match input.username {
        Some(value) => {
            let value = value.trim().to_owned();
            if value.len() < 2 || value.len() > 32 {
                return json_error(
                    StatusCode::BAD_REQUEST,
                    "用户名长度需在 2-32 之间",
                    "USERNAME_INVALID",
                );
            }
            value
        }
        None => existing.username.clone(),
    };
    if username != existing.username {
        match sqlx::query("SELECT 1 FROM users WHERE username = ? AND id <> ? LIMIT 1")
            .bind(&username)
            .bind(&current.id)
            .fetch_optional(&state.db)
            .await
        {
            Ok(Some(_)) => {
                return json_error(StatusCode::BAD_REQUEST, "用户名已被使用", "USERNAME_IN_USE");
            }
            Ok(None) => {}
            Err(error) => return app_error(error),
        }
    }

    let password_changed = input.password.is_some();
    let password_hash = if let Some(password) = input.password {
        if password.len() < 8
            || password.len() > 128
            || !password.chars().any(|char| char.is_ascii_alphabetic())
            || !password.chars().any(|char| char.is_ascii_digit())
        {
            return json_error(
                StatusCode::BAD_REQUEST,
                "新密码需 8-128 位，包含字母和数字",
                "PASSWORD_INVALID",
            );
        }
        let Some(current_password) = input.current_password else {
            return json_error(
                StatusCode::BAD_REQUEST,
                "需要当前密码",
                "CURRENT_PASSWORD_REQUIRED",
            );
        };
        match auth::verify_password(current_password, existing.password_hash.clone()).await {
            Ok(true) => {}
            Ok(false) => {
                return json_error(
                    StatusCode::BAD_REQUEST,
                    "当前密码错误",
                    "CURRENT_PASSWORD_WRONG",
                );
            }
            Err(error) => return app_error(error),
        }
        match auth::hash_password(password).await {
            Ok(value) => value,
            Err(error) => return app_error(error),
        }
    } else {
        existing.password_hash.clone()
    };

    let bark = match input.bark_url {
        Some(value) => {
            let value = value
                .map(|value| value.trim().to_owned())
                .filter(|value| !value.is_empty());
            if let Some(value) = &value
                && (value.len() > 2048 || !notifications::is_safe_bark_target(value).await)
            {
                return json_error(
                    StatusCode::BAD_REQUEST,
                    "Bark URL 不安全或格式无效",
                    "BARK_URL_INVALID",
                );
            }
            match value {
                Some(value) => match crypto::encrypt(&state.config, &value) {
                    Ok((data, iv)) => (None, Some(data), Some(iv)),
                    Err(error) => return app_error(error),
                },
                None => (None, None, None),
            }
        }
        None => (
            existing.bark_url.clone(),
            existing.bark_url_data.clone(),
            existing.bark_url_iv.clone(),
        ),
    };

    let telegram_token = match input.telegram_bot_token {
        Some(value) => {
            let value = value
                .map(|value| value.trim().to_owned())
                .filter(|value| !value.is_empty());
            if value.as_ref().is_some_and(|value| value.len() > 128) {
                return json_error(
                    StatusCode::BAD_REQUEST,
                    "Telegram Bot Token 格式无效",
                    "TELEGRAM_TOKEN_INVALID",
                );
            }
            match value {
                Some(value) => match crypto::encrypt(&state.config, &value) {
                    Ok((data, iv)) => (None, Some(data), Some(iv)),
                    Err(error) => return app_error(error),
                },
                None => (None, None, None),
            }
        }
        None => (
            existing.telegram_bot_token.clone(),
            existing.telegram_bot_token_data.clone(),
            existing.telegram_bot_token_iv.clone(),
        ),
    };

    let telegram_chat_id = match input.telegram_chat_id {
        Some(value) => {
            let value = value
                .map(|value| value.trim().to_owned())
                .filter(|value| !value.is_empty());
            if value.as_ref().is_some_and(|value| value.len() > 64) {
                return json_error(
                    StatusCode::BAD_REQUEST,
                    "Telegram Chat ID 格式无效",
                    "TELEGRAM_CHAT_ID_INVALID",
                );
            }
            value
        }
        None => existing.telegram_chat_id.clone(),
    };
    let locale = match input.locale {
        Some(value) if value == "zh" || value == "en" => value,
        Some(_) => return json_error(StatusCode::BAD_REQUEST, "无效的语言设置", "INVALID_LOCALE"),
        None => existing.locale.unwrap_or_else(|| "zh".to_owned()),
    };
    let now = chrono::Utc::now().timestamp_millis();

    if let Err(error) = sqlx::query(
        "UPDATE users SET username = ?, password_hash = ?, locale = ?, bark_url = ?, bark_url_data = ?, bark_url_iv = ?, telegram_bot_token = ?, telegram_bot_token_data = ?, telegram_bot_token_iv = ?, telegram_chat_id = ?, updated_at = ? WHERE id = ?",
    )
    .bind(username)
    .bind(password_hash)
    .bind(locale)
    .bind(bark.0)
    .bind(bark.1)
    .bind(bark.2)
    .bind(telegram_token.0)
    .bind(telegram_token.1)
    .bind(telegram_token.2)
    .bind(telegram_chat_id)
    .bind(now)
    .bind(&current.id)
    .execute(&state.db)
    .await
    {
        return app_error(error);
    }

    let response = no_store(serde_json::json!({
        "success": true,
        "sessionInvalidated": password_changed,
    }));
    if password_changed {
        return with_set_cookie(response, auth::expired_session_cookie(secure_cookie()));
    }
    response
}

pub async fn test_push(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<TestPushRequest>,
) -> Response {
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    match input.r#type.as_str() {
        "bark" => {
            let Some(url) = input.bark_url.filter(|value| !value.trim().is_empty()) else {
                return json_error(
                    StatusCode::BAD_REQUEST,
                    "请先填写 Bark URL",
                    "PUSH_BARK_URL_REQUIRED",
                );
            };
            let message = PushMessage {
                title: "MiMotion 测试推送",
                body: "如果你看到这条消息，说明 Bark 推送配置成功！",
                subtitle: None,
            };
            match notifications::send_bark(&state.http, url.trim(), &message).await {
                Ok(()) => no_store(serde_json::json!({
                    "success": true,
                    "message": "Bark 测试推送已发送",
                })),
                Err(error) => {
                    tracing::warn!(user_id = %user.id, %error, event = "bark_test_failed");
                    json_error(
                        StatusCode::BAD_REQUEST,
                        "推送请求失败，请检查 URL 是否正确",
                        "PUSH_REQUEST_FAILED",
                    )
                }
            }
        }
        "telegram" => {
            let (Some(token), Some(chat_id)) = (
                input.telegram_bot_token.filter(|value| !value.is_empty()),
                input.telegram_chat_id.filter(|value| !value.is_empty()),
            ) else {
                return json_error(
                    StatusCode::BAD_REQUEST,
                    "请先填写 Bot Token 和 Chat ID",
                    "PUSH_TELEGRAM_REQUIRED",
                );
            };
            let message = PushMessage {
                title: "MiMotion 测试推送",
                body: "如果你看到这条消息，说明 Telegram 推送配置成功！",
                subtitle: None,
            };
            match notifications::send_telegram(&state.http, &token, &chat_id, &message).await {
                Ok(()) => no_store(serde_json::json!({
                    "success": true,
                    "message": "Telegram 测试推送已发送",
                })),
                Err(error) => {
                    tracing::warn!(user_id = %user.id, %error, event = "telegram_test_failed");
                    json_error(
                        StatusCode::BAD_REQUEST,
                        "推送请求失败，请检查配置是否正确",
                        "PUSH_TELEGRAM_FAILED",
                    )
                }
            }
        }
        _ => json_error(
            StatusCode::BAD_REQUEST,
            "未知的推送类型",
            "PUSH_TYPE_UNKNOWN",
        ),
    }
}

async fn fetch_user(state: &Arc<AppState>, user_id: &str) -> Result<Option<UserRow>, sqlx::Error> {
    sqlx::query_as::<_, UserRow>(
        "SELECT id, username, password_hash, is_admin, locale, bark_url, bark_url_data, bark_url_iv, telegram_bot_token, telegram_bot_token_data, telegram_bot_token_iv, telegram_chat_id, created_at, updated_at FROM users WHERE id = ? LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
}

#[allow(dead_code)]
fn _row_id(row: &sqlx::sqlite::SqliteRow) -> Option<String> {
    row.try_get("id").ok()
}
