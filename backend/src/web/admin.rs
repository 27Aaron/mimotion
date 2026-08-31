use std::sync::Arc;

use axum::{
    Json,
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::Response,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;

use crate::{auth, state::AppState};

use super::common::{app_error, json_error, no_store, require_admin};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserQuery {
    id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResetPasswordRequest {
    user_id: String,
    new_password: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct UserResponse {
    id: String,
    username: String,
    #[serde(rename = "isAdmin")]
    is_admin: bool,
    bark_configured: bool,
    telegram_configured: bool,
    created_at: String,
    updated_at: String,
    account_count: i64,
    active_schedules: i64,
    total_schedules: i64,
}

pub async fn list(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    let rows = match sqlx::query(
        "SELECT u.id, u.username, u.is_admin, u.bark_url, u.bark_url_data, u.telegram_bot_token, u.telegram_bot_token_data, u.telegram_chat_id, u.created_at, u.updated_at, (SELECT COUNT(*) FROM xiaomi_accounts a WHERE a.user_id = u.id) AS account_count, (SELECT COUNT(*) FROM schedules s WHERE s.user_id = u.id AND s.is_active = 1) AS active_schedules, (SELECT COUNT(*) FROM schedules s WHERE s.user_id = u.id) AS total_schedules FROM users u ORDER BY u.created_at ASC",
    )
    .fetch_all(&state.db)
    .await
    {
        Ok(rows) => rows,
        Err(error) => return app_error(error),
    };

    let result = rows
        .into_iter()
        .map(|row| {
            let id = row.get::<String, _>("id");
            UserResponse {
                id,
                username: row.get("username"),
                is_admin: row.get::<Option<i64>, _>("is_admin").unwrap_or_default() != 0,
                bark_configured: row
                    .get::<Option<String>, _>("bark_url_data")
                    .or_else(|| row.get::<Option<String>, _>("bark_url"))
                    .is_some_and(|value| !value.is_empty()),
                telegram_configured: row
                    .get::<Option<String>, _>("telegram_bot_token_data")
                    .or_else(|| row.get::<Option<String>, _>("telegram_bot_token"))
                    .is_some_and(|value| {
                        !value.is_empty()
                            && row
                                .get::<Option<String>, _>("telegram_chat_id")
                                .is_some_and(|chat_id| !chat_id.is_empty())
                    }),
                created_at: crate::scheduling::cron::timestamp_to_iso(Some(row.get("created_at")))
                    .unwrap_or_else(|| row.get::<i64, _>("created_at").to_string()),
                updated_at: crate::scheduling::cron::timestamp_to_iso(Some(row.get("updated_at")))
                    .unwrap_or_else(|| row.get::<i64, _>("updated_at").to_string()),
                account_count: row.get("account_count"),
                active_schedules: row.get("active_schedules"),
                total_schedules: row.get("total_schedules"),
            }
        })
        .collect::<Vec<_>>();
    no_store(result)
}

pub async fn reset_password(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<ResetPasswordRequest>,
) -> Response {
    let admin = match require_admin(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    if input.user_id == admin.id {
        return json_error(
            StatusCode::BAD_REQUEST,
            "请通过设置页修改自己的密码",
            "CANNOT_RESET_SELF",
        );
    }
    if input.new_password.len() < 8
        || input.new_password.len() > 128
        || !input
            .new_password
            .chars()
            .any(|char| char.is_ascii_alphabetic())
        || !input.new_password.chars().any(|char| char.is_ascii_digit())
    {
        return json_error(
            StatusCode::BAD_REQUEST,
            "密码需 8 位以上，包含字母和数字",
            "PASSWORD_INVALID",
        );
    }
    let password_hash = match auth::hash_password(input.new_password).await {
        Ok(value) => value,
        Err(error) => return app_error(error),
    };
    match sqlx::query("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
        .bind(password_hash)
        .bind(chrono::Utc::now().timestamp_millis())
        .bind(input.user_id)
        .execute(&state.db)
        .await
    {
        Ok(result) if result.rows_affected() == 1 => {
            no_store(serde_json::json!({ "success": true }))
        }
        Ok(_) => json_error(StatusCode::NOT_FOUND, "用户不存在", "USER_NOT_FOUND"),
        Err(error) => app_error(error),
    }
}

pub async fn delete(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<UserQuery>,
) -> Response {
    let admin = match require_admin(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let Some(user_id) = query.id.filter(|value| !value.is_empty()) else {
        return json_error(
            StatusCode::BAD_REQUEST,
            "缺少有效的用户 ID",
            "MISSING_PARAMS",
        );
    };
    if user_id == admin.id {
        return json_error(
            StatusCode::BAD_REQUEST,
            "不能删除自己",
            "CANNOT_DELETE_SELF",
        );
    }

    let mut transaction = match state.db.begin().await {
        Ok(transaction) => transaction,
        Err(error) => return app_error(error),
    };
    let schedule_ids = match sqlx::query("SELECT id FROM schedules WHERE user_id = ?")
        .bind(&user_id)
        .fetch_all(&mut *transaction)
        .await
    {
        Ok(rows) => rows
            .into_iter()
            .map(|row| row.get::<String, _>("id"))
            .collect::<Vec<_>>(),
        Err(error) => return app_error(error),
    };
    for schedule_id in &schedule_ids {
        if let Err(error) = sqlx::query("DELETE FROM run_logs WHERE schedule_id = ?")
            .bind(schedule_id)
            .execute(&mut *transaction)
            .await
        {
            return app_error(error);
        }
    }
    for statement in [
        "DELETE FROM schedules WHERE user_id = ?",
        "DELETE FROM xiaomi_accounts WHERE user_id = ?",
        "UPDATE invite_codes SET used_by = NULL WHERE used_by = ?",
        "DELETE FROM invite_codes WHERE created_by = ?",
        "DELETE FROM users WHERE id = ?",
    ] {
        if let Err(error) = sqlx::query(statement)
            .bind(&user_id)
            .execute(&mut *transaction)
            .await
        {
            return app_error(error);
        }
    }
    if let Err(error) = transaction.commit().await {
        return app_error(error);
    }
    no_store(serde_json::json!({ "success": true }))
}
