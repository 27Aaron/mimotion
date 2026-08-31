use std::sync::Arc;

use axum::{
    Json,
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::Response,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;

use crate::{
    scheduling::cron,
    security::crypto,
    state::AppState,
    storage::models::XiaomiAccountRow,
    xiaomi::{self, StoredXiaomiCredentials, ZeppErrorCode},
};

use super::common::{app_error, json_error, no_store, require_user};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountQuery {
    id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAccountRequest {
    account: String,
    password: String,
    nickname: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAccountRequest {
    nickname: Option<String>,
    status: Option<String>,
    account: Option<String>,
    password: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AccountResponse {
    id: String,
    nickname: String,
    account: Option<String>,
    status: String,
    last_sync_at: Option<String>,
    last_error: Option<String>,
    created_at: String,
    updated_at: String,
    schedule_count: i64,
    active_schedule_count: i64,
    last_step: Option<i64>,
}

pub async fn list(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let accounts = match sqlx::query_as::<_, XiaomiAccountRow>(
        "SELECT id, user_id, xiaomi_user_id, account, token_data, token_iv, login_token_data, login_token_iv, password_data, password_iv, device_id, nickname, status, last_sync_at, last_error, created_at, updated_at FROM xiaomi_accounts WHERE user_id = ? ORDER BY created_at ASC, id ASC",
    )
    .bind(&user.id)
    .fetch_all(&state.db)
    .await
    {
        Ok(rows) => rows,
        Err(error) => return app_error(error),
    };

    let mut result = Vec::with_capacity(accounts.len());
    for account in accounts {
        let counts = match sqlx::query(
            "SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END), 0) AS active FROM schedules WHERE user_id = ? AND xiaomi_account_id = ?",
        )
        .bind(&user.id)
        .bind(&account.id)
        .fetch_one(&state.db)
        .await
        {
            Ok(row) => row,
            Err(error) => return app_error(error),
        };
        let last_step = match sqlx::query(
            "SELECT rl.step_written FROM run_logs rl JOIN schedules s ON s.id = rl.schedule_id WHERE s.user_id = ? AND s.xiaomi_account_id = ? ORDER BY rl.executed_at DESC, rl.id DESC LIMIT 1",
        )
        .bind(&user.id)
        .bind(&account.id)
        .fetch_optional(&state.db)
        .await
        {
            Ok(row) => row.and_then(|row| row.get("step_written")),
            Err(error) => return app_error(error),
        };
        result.push(AccountResponse {
            id: account.id,
            nickname: account.nickname.unwrap_or_else(|| {
                account
                    .account
                    .clone()
                    .unwrap_or_else(|| "未命名账号".to_owned())
            }),
            account: account.account,
            status: account.status.unwrap_or_else(|| "active".to_owned()),
            last_sync_at: cron::timestamp_to_iso(account.last_sync_at),
            last_error: account.last_error,
            created_at: cron::timestamp_to_iso(Some(account.created_at))
                .unwrap_or_else(|| account.created_at.to_string()),
            updated_at: cron::timestamp_to_iso(Some(account.updated_at))
                .unwrap_or_else(|| account.updated_at.to_string()),
            schedule_count: counts.get("total"),
            active_schedule_count: counts.get("active"),
            last_step,
        });
    }
    no_store(result)
}

pub async fn create(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<CreateAccountRequest>,
) -> Response {
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    if input.account.trim().is_empty()
        || input.account.len() > 128
        || input.password.is_empty()
        || input.password.len() > 128
    {
        return json_error(
            StatusCode::BAD_REQUEST,
            "账号或密码格式无效",
            "VALIDATION_FAILED",
        );
    }
    let nickname = input
        .nickname
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty());
    if nickname.as_ref().is_some_and(|value| value.len() > 64) {
        return json_error(
            StatusCode::BAD_REQUEST,
            "昵称长度不能超过 64",
            "VALIDATION_FAILED",
        );
    }

    let login = xiaomi::login_account(&state.http, input.account.trim(), &input.password).await;
    if !login.success {
        return json_error(
            StatusCode::BAD_REQUEST,
            login.error.unwrap_or_else(|| "小米账号验证失败".to_owned()),
            "XIAOMI_LOGIN_FAILED",
        );
    }
    let Some(app_token) = login.app_token.as_deref() else {
        return json_error(
            StatusCode::BAD_REQUEST,
            "获取 app_token 失败",
            "XIAOMI_LOGIN_FAILED",
        );
    };
    let (token_data, token_iv) = match crypto::encrypt(&state.config, app_token) {
        Ok(value) => value,
        Err(error) => return app_error(error),
    };
    let (login_token_data, login_token_iv) = match login.login_token.as_deref() {
        Some(value) => match crypto::encrypt(&state.config, value) {
            Ok((data, iv)) => (Some(data), Some(iv)),
            Err(error) => return app_error(error),
        },
        None => (None, None),
    };
    let (password_data, password_iv) = match crypto::encrypt(&state.config, &input.password) {
        Ok(value) => value,
        Err(error) => return app_error(error),
    };
    let now = chrono::Utc::now().timestamp_millis();
    let id = uuid::Uuid::new_v4().to_string();
    let final_nickname = nickname.unwrap_or_else(|| input.account.trim().to_owned());
    if let Err(error) = sqlx::query(
        "INSERT INTO xiaomi_accounts (id, user_id, xiaomi_user_id, account, token_data, token_iv, login_token_data, login_token_iv, password_data, password_iv, device_id, nickname, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)",
    )
    .bind(&id)
    .bind(&user.id)
    .bind(login.user_id)
    .bind(input.account.trim())
    .bind(token_data)
    .bind(token_iv)
    .bind(login_token_data)
    .bind(login_token_iv)
    .bind(password_data)
    .bind(password_iv)
    .bind(login.device_id)
    .bind(&final_nickname)
    .bind(now)
    .bind(now)
    .execute(&state.db)
    .await
    {
        return app_error(error);
    }
    no_store(serde_json::json!({
        "id": id,
        "nickname": final_nickname,
        "status": "active",
    }))
}

pub async fn update(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<AccountQuery>,
    Json(input): Json<UpdateAccountRequest>,
) -> Response {
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let Some(id) = query.id.filter(|value| !value.is_empty()) else {
        return json_error(StatusCode::BAD_REQUEST, "缺少有效的 id", "MISSING_ID");
    };
    let existing = match fetch_account(&state, &user.id, &id).await {
        Ok(Some(row)) => row,
        Ok(None) => {
            return json_error(StatusCode::NOT_FOUND, "小米账号不存在", "ACCOUNT_NOT_FOUND");
        }
        Err(error) => return app_error(error),
    };
    if input.account.is_some() != input.password.is_some() {
        return json_error(
            StatusCode::BAD_REQUEST,
            "重新登录时需同时提供账号和密码",
            "VALIDATION_FAILED",
        );
    }
    if let Some(status) = &input.status
        && status != "active"
        && status != "error"
    {
        return json_error(StatusCode::BAD_REQUEST, "账号状态无效", "VALIDATION_FAILED");
    }
    let nickname = input
        .nickname
        .or(existing.nickname.clone())
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty());
    if nickname.as_ref().is_some_and(|value| value.len() > 64) {
        return json_error(
            StatusCode::BAD_REQUEST,
            "昵称长度不能超过 64",
            "VALIDATION_FAILED",
        );
    }

    let mut account = existing.account.clone();
    let mut xiaomi_user_id = existing.xiaomi_user_id.clone();
    let mut token_data = existing.token_data.clone();
    let mut token_iv = existing.token_iv.clone();
    let mut login_token_data = existing.login_token_data.clone();
    let mut login_token_iv = existing.login_token_iv.clone();
    let mut password_data = existing.password_data.clone();
    let mut password_iv = existing.password_iv.clone();
    let mut device_id = existing.device_id.clone();
    let mut status = input.status.unwrap_or_else(|| {
        existing
            .status
            .clone()
            .unwrap_or_else(|| "active".to_owned())
    });
    let mut last_error = existing.last_error.clone();

    if let (Some(new_account), Some(new_password)) = (input.account, input.password) {
        if new_account.trim().is_empty()
            || new_account.len() > 128
            || new_password.is_empty()
            || new_password.len() > 128
        {
            return json_error(
                StatusCode::BAD_REQUEST,
                "账号或密码格式无效",
                "VALIDATION_FAILED",
            );
        }
        let login = xiaomi::login_account(&state.http, new_account.trim(), &new_password).await;
        if !login.success {
            return json_error(
                StatusCode::BAD_REQUEST,
                login.error.unwrap_or_else(|| "小米账号验证失败".to_owned()),
                "XIAOMI_LOGIN_FAILED",
            );
        }
        let Some(app_token) = login.app_token.as_deref() else {
            return json_error(
                StatusCode::BAD_REQUEST,
                "获取 app_token 失败",
                "XIAOMI_LOGIN_FAILED",
            );
        };
        let encrypted = match crypto::encrypt(&state.config, app_token) {
            Ok(value) => value,
            Err(error) => return app_error(error),
        };
        let login_encrypted = match login.login_token.as_deref() {
            Some(value) => match crypto::encrypt(&state.config, value) {
                Ok(value) => (Some(value.0), Some(value.1)),
                Err(error) => return app_error(error),
            },
            None => (None, None),
        };
        let password_encrypted = match crypto::encrypt(&state.config, &new_password) {
            Ok(value) => value,
            Err(error) => return app_error(error),
        };
        account = Some(new_account.trim().to_owned());
        xiaomi_user_id = login.user_id;
        token_data = encrypted.0;
        token_iv = Some(encrypted.1);
        login_token_data = login_encrypted.0;
        login_token_iv = login_encrypted.1;
        password_data = Some(password_encrypted.0);
        password_iv = Some(password_encrypted.1);
        device_id = login.device_id;
        status = "active".to_owned();
        last_error = None;
    }

    let now = chrono::Utc::now().timestamp_millis();
    if let Err(error) = sqlx::query(
        "UPDATE xiaomi_accounts SET xiaomi_user_id = ?, account = ?, token_data = ?, token_iv = ?, login_token_data = ?, login_token_iv = ?, password_data = ?, password_iv = ?, device_id = ?, nickname = ?, status = ?, last_error = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    )
    .bind(xiaomi_user_id)
    .bind(account)
    .bind(token_data)
    .bind(token_iv)
    .bind(login_token_data)
    .bind(login_token_iv)
    .bind(password_data)
    .bind(password_iv)
    .bind(device_id)
    .bind(nickname)
    .bind(status)
    .bind(last_error)
    .bind(now)
    .bind(id)
    .bind(user.id)
    .execute(&state.db)
    .await
    {
        return app_error(error);
    }
    no_store(serde_json::json!({ "success": true }))
}

pub async fn delete(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<AccountQuery>,
) -> Response {
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let Some(id) = query.id.filter(|value| !value.is_empty()) else {
        return json_error(StatusCode::BAD_REQUEST, "缺少有效的 id", "MISSING_ID");
    };
    let mut transaction = match state.db.begin().await {
        Ok(transaction) => transaction,
        Err(error) => return app_error(error),
    };
    if let Err(error) = sqlx::query(
        "DELETE FROM run_logs WHERE schedule_id IN (SELECT id FROM schedules WHERE xiaomi_account_id = ? AND user_id = ?)",
    )
    .bind(&id)
    .bind(&user.id)
    .execute(&mut *transaction)
    .await
    {
        return app_error(error);
    }
    if let Err(error) =
        sqlx::query("DELETE FROM schedules WHERE xiaomi_account_id = ? AND user_id = ?")
            .bind(&id)
            .bind(&user.id)
            .execute(&mut *transaction)
            .await
    {
        return app_error(error);
    }
    let deleted = match sqlx::query("DELETE FROM xiaomi_accounts WHERE id = ? AND user_id = ?")
        .bind(&id)
        .bind(&user.id)
        .execute(&mut *transaction)
        .await
    {
        Ok(result) => result.rows_affected(),
        Err(error) => return app_error(error),
    };
    if deleted != 1 {
        return json_error(StatusCode::NOT_FOUND, "小米账号不存在", "ACCOUNT_NOT_FOUND");
    }
    if let Err(error) = transaction.commit().await {
        return app_error(error);
    }
    no_store(serde_json::json!({ "success": true }))
}

async fn fetch_account(
    state: &Arc<AppState>,
    user_id: &str,
    id: &str,
) -> Result<Option<XiaomiAccountRow>, sqlx::Error> {
    sqlx::query_as::<_, XiaomiAccountRow>(
        "SELECT id, user_id, xiaomi_user_id, account, token_data, token_iv, login_token_data, login_token_iv, password_data, password_iv, device_id, nickname, status, last_sync_at, last_error, created_at, updated_at FROM xiaomi_accounts WHERE id = ? AND user_id = ? LIMIT 1",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
}

#[allow(dead_code)]
fn _credential_shape(account: &XiaomiAccountRow) -> StoredXiaomiCredentials {
    StoredXiaomiCredentials {
        account: account.account.clone(),
        xiaomi_user_id: account.xiaomi_user_id.clone(),
        device_id: account.device_id.clone(),
        token_data: account.token_data.clone(),
        token_iv: account.token_iv.clone(),
        login_token_data: account.login_token_data.clone(),
        login_token_iv: account.login_token_iv.clone(),
        password_data: account.password_data.clone(),
        password_iv: account.password_iv.clone(),
    }
}

#[allow(dead_code)]
fn _is_token_expired(result: &xiaomi::SetStepResult) -> bool {
    result.error_code == Some(ZeppErrorCode::TokenExpired)
}
