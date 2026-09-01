use std::sync::Arc;

use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
    response::Response,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;

use crate::{
    auth::AuthUser,
    config::Config,
    scheduling::cron,
    security::crypto,
    state::AppState,
    storage::queries::{find_account_for_user, find_accounts_by_user},
    util::now_ms,
    xiaomi,
};

use super::common::{app_error, json_error, no_store, require_id};

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

pub async fn list(State(state): State<Arc<AppState>>, user: AuthUser) -> Response {
    let accounts = match find_accounts_by_user(&state.db, &user.id).await {
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
            created_at: cron::timestamp_to_iso_or_raw(account.created_at),
            updated_at: cron::timestamp_to_iso_or_raw(account.updated_at),
            schedule_count: counts.get("total"),
            active_schedule_count: counts.get("active"),
            last_step,
        });
    }
    no_store(result)
}

pub async fn create(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Json(input): Json<CreateAccountRequest>,
) -> Response {
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
    let credentials = match encrypt_credentials(
        &state.config,
        app_token,
        login.login_token.as_deref(),
        &input.password,
    ) {
        Ok(value) => value,
        Err(response) => return response,
    };
    let now = now_ms();
    let id = uuid::Uuid::new_v4().to_string();
    let final_nickname = nickname.unwrap_or_else(|| input.account.trim().to_owned());
    if let Err(error) = sqlx::query(
        "INSERT INTO xiaomi_accounts (id, user_id, xiaomi_user_id, account, token_data, token_iv, login_token_data, login_token_iv, password_data, password_iv, device_id, nickname, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)",
    )
    .bind(&id)
    .bind(&user.id)
    .bind(login.user_id)
    .bind(input.account.trim())
    .bind(credentials.token_data)
    .bind(credentials.token_iv)
    .bind(credentials.login_token_data)
    .bind(credentials.login_token_iv)
    .bind(credentials.password_data)
    .bind(credentials.password_iv)
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
    user: AuthUser,
    Query(query): Query<AccountQuery>,
    Json(input): Json<UpdateAccountRequest>,
) -> Response {
    let id = match require_id(query.id.as_deref()) {
        Ok(id) => id,
        Err(response) => return response,
    };
    let existing = match find_account_for_user(&state.db, &id, &user.id).await {
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
    let mut token_data = Some(existing.token_data.clone());
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
        let encrypted = match encrypt_credentials(
            &state.config,
            app_token,
            login.login_token.as_deref(),
            &new_password,
        ) {
            Ok(value) => value,
            Err(response) => return response,
        };
        account = Some(new_account.trim().to_owned());
        xiaomi_user_id = login.user_id;
        token_data = Some(encrypted.token_data);
        token_iv = Some(encrypted.token_iv);
        login_token_data = encrypted.login_token_data;
        login_token_iv = encrypted.login_token_iv;
        password_data = encrypted.password_data;
        password_iv = encrypted.password_iv;
        device_id = login.device_id;
        status = "active".to_owned();
        last_error = None;
    }

    let now = now_ms();
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
    user: AuthUser,
    Query(query): Query<AccountQuery>,
) -> Response {
    let id = match require_id(query.id.as_deref()) {
        Ok(id) => id,
        Err(response) => return response,
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

struct EncryptedCredentials {
    token_data: String,
    token_iv: String,
    login_token_data: Option<String>,
    login_token_iv: Option<String>,
    password_data: Option<String>,
    password_iv: Option<String>,
}

#[allow(clippy::result_large_err)]
fn encrypt_credentials(
    config: &Config,
    app_token: &str,
    login_token: Option<&str>,
    password: &str,
) -> Result<EncryptedCredentials, Response> {
    let (token_data, token_iv) = crypto::encrypt(config, app_token).map_err(app_error)?;
    let (login_token_data, login_token_iv) = match login_token {
        Some(value) => {
            let (data, iv) = crypto::encrypt(config, value).map_err(app_error)?;
            (Some(data), Some(iv))
        }
        None => (None, None),
    };
    let (password_data, password_iv) = crypto::encrypt(config, password).map_err(app_error)?;
    Ok(EncryptedCredentials {
        token_data,
        token_iv,
        login_token_data,
        login_token_iv,
        password_data: Some(password_data),
        password_iv: Some(password_iv),
    })
}
