use std::sync::Arc;

use axum::{Json, extract::State, http::StatusCode, response::Response};
use serde::{Deserialize, Serialize};

use crate::{
    auth::{self, AuthUser},
    config::Config,
    notifications::{self, PushMessage},
    security::crypto,
    state::AppState,
    storage::queries::find_user_by_id,
    util::now_ms,
};

use super::common::{app_error, json_error, no_store, secure_cookie, with_set_cookie};

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

pub async fn get(State(state): State<Arc<AppState>>, user: AuthUser) -> Response {
    let row = match find_user_by_id(&state.db, &user.id).await {
        Ok(Some(row)) => row,
        Ok(None) => return json_error(StatusCode::UNAUTHORIZED, "Token 无效", "TOKEN_INVALID"),
        Err(error) => return app_error(error),
    };
    let secrets = match notifications::decrypt_user_secrets(&state.config, &row) {
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
    user: AuthUser,
    Json(input): Json<UpdateSettingsRequest>,
) -> Response {
    let existing = match find_user_by_id(&state.db, &user.id).await {
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
            .bind(&user.id)
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
            match store_secret(&state.config, value) {
                Ok(encrypted) => encrypted,
                Err(response) => return response,
            }
        }
        None => StoredSecret {
            legacy: existing.bark_url.clone(),
            data: existing.bark_url_data.clone(),
            iv: existing.bark_url_iv.clone(),
        },
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
            match store_secret(&state.config, value) {
                Ok(encrypted) => encrypted,
                Err(response) => return response,
            }
        }
        None => StoredSecret {
            legacy: existing.telegram_bot_token.clone(),
            data: existing.telegram_bot_token_data.clone(),
            iv: existing.telegram_bot_token_iv.clone(),
        },
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
    let now = now_ms();

    if let Err(error) = sqlx::query(
        "UPDATE users SET username = ?, password_hash = ?, locale = ?, bark_url = ?, bark_url_data = ?, bark_url_iv = ?, telegram_bot_token = ?, telegram_bot_token_data = ?, telegram_bot_token_iv = ?, telegram_chat_id = ?, updated_at = ? WHERE id = ?",
    )
    .bind(username)
    .bind(password_hash)
    .bind(locale)
    .bind(bark.legacy)
    .bind(bark.data)
    .bind(bark.iv)
    .bind(telegram_token.legacy)
    .bind(telegram_token.data)
    .bind(telegram_token.iv)
    .bind(telegram_chat_id)
    .bind(now)
    .bind(&user.id)
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
    user: AuthUser,
    Json(input): Json<TestPushRequest>,
) -> Response {
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

struct StoredSecret {
    legacy: Option<String>,
    data: Option<String>,
    iv: Option<String>,
}

#[allow(clippy::result_large_err)]
fn store_secret(config: &Config, value: Option<String>) -> Result<StoredSecret, Response> {
    match value {
        Some(value) => crypto::encrypt(config, &value)
            .map(|(data, iv)| StoredSecret {
                legacy: None,
                data: Some(data),
                iv: Some(iv),
            })
            .map_err(app_error),
        None => Ok(StoredSecret {
            legacy: None,
            data: None,
            iv: None,
        }),
    }
}
