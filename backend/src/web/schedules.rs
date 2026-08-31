use std::sync::Arc;

use crate::{scheduling::cron, state::AppState, storage::models::ScheduleRow};
use axum::{
    Json,
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::Response,
};
use serde::{Deserialize, Serialize};

use super::common::{app_error, json_error, no_store, require_user};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleQuery {
    id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateScheduleRequest {
    xiaomi_account_id: String,
    cron_expression: String,
    min_step: i64,
    max_step: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateScheduleRequest {
    xiaomi_account_id: Option<String>,
    cron_expression: Option<String>,
    min_step: Option<i64>,
    max_step: Option<i64>,
    is_active: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScheduleResponse {
    id: String,
    xiaomi_account_id: String,
    account_nickname: String,
    cron_expression: String,
    min_step: i64,
    max_step: i64,
    is_active: bool,
    last_run_at: Option<String>,
    next_run_at: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct ScheduleWithNickname {
    id: String,
    xiaomi_account_id: String,
    account_nickname: Option<String>,
    cron_expression: String,
    min_step: i64,
    max_step: i64,
    is_active: Option<i64>,
    last_run_at: Option<i64>,
    next_run_at: Option<i64>,
}

pub async fn list(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let rows = match sqlx::query_as::<_, ScheduleWithNickname>(
        "SELECT s.id, s.xiaomi_account_id, a.nickname AS account_nickname, s.cron_expression, s.min_step, s.max_step, s.is_active, s.last_run_at, s.next_run_at FROM schedules s LEFT JOIN xiaomi_accounts a ON a.id = s.xiaomi_account_id AND a.user_id = s.user_id WHERE s.user_id = ? ORDER BY s.created_at ASC, s.id ASC",
    )
    .bind(user.id)
    .fetch_all(&state.db)
    .await
    {
        Ok(rows) => rows,
        Err(error) => return app_error(error),
    };

    no_store(
        rows.into_iter()
            .map(|row| ScheduleResponse {
                id: row.id,
                xiaomi_account_id: row.xiaomi_account_id,
                account_nickname: row.account_nickname.unwrap_or_else(|| "未知".to_owned()),
                cron_expression: row.cron_expression,
                min_step: row.min_step,
                max_step: row.max_step,
                is_active: row.is_active.unwrap_or_default() != 0,
                last_run_at: cron::timestamp_to_iso(row.last_run_at),
                next_run_at: cron::timestamp_to_iso(row.next_run_at),
            })
            .collect::<Vec<_>>(),
    )
}

pub async fn create(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<CreateScheduleRequest>,
) -> Response {
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    if !valid_step_range(input.min_step, input.max_step) {
        return json_error(
            StatusCode::BAD_REQUEST,
            "步数范围无效",
            "STEP_RANGE_INVALID",
        );
    }
    let Some(expression) = cron::normalize(&input.cron_expression) else {
        return json_error(
            StatusCode::BAD_REQUEST,
            "Cron 表达式格式或取值无效",
            "CRON_INVALID",
        );
    };
    if !owned_account(&state, &user.id, &input.xiaomi_account_id).await {
        return json_error(StatusCode::NOT_FOUND, "小米账号不存在", "ACCOUNT_NOT_FOUND");
    }

    let now = chrono::Utc::now().timestamp_millis();
    let id = uuid::Uuid::new_v4().to_string();
    let next_run_at = cron::next_occurrence(&expression, now);
    if let Err(error) = sqlx::query(
        "INSERT INTO schedules (id, user_id, xiaomi_account_id, cron_expression, min_step, max_step, is_active, next_run_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)",
    )
    .bind(&id)
    .bind(user.id)
    .bind(input.xiaomi_account_id)
    .bind(expression)
    .bind(input.min_step)
    .bind(input.max_step)
    .bind(next_run_at)
    .bind(now)
    .bind(now)
    .execute(&state.db)
    .await
    {
        return app_error(error);
    }
    no_store(serde_json::json!({ "id": id }))
}

pub async fn update(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ScheduleQuery>,
    Json(input): Json<UpdateScheduleRequest>,
) -> Response {
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let Some(id) = query.id.filter(|value| !value.is_empty()) else {
        return json_error(StatusCode::BAD_REQUEST, "缺少有效的 id", "MISSING_ID");
    };
    let existing = match sqlx::query_as::<_, ScheduleRow>(
        "SELECT id, user_id, xiaomi_account_id, cron_expression, min_step, max_step, is_active, last_run_at, next_run_at, created_at, updated_at FROM schedules WHERE id = ? AND user_id = ? LIMIT 1",
    )
    .bind(&id)
    .bind(&user.id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => {
            return json_error(StatusCode::NOT_FOUND, "定时任务不存在", "SCHEDULE_NOT_FOUND");
        }
        Err(error) => return app_error(error),
    };
    if input.min_step.is_some() != input.max_step.is_some() {
        return json_error(
            StatusCode::BAD_REQUEST,
            "需同时提供最小和最大步数",
            "STEP_RANGE_INVALID",
        );
    }
    let min_step = input.min_step.unwrap_or(existing.min_step);
    let max_step = input.max_step.unwrap_or(existing.max_step);
    if !valid_step_range(min_step, max_step) {
        return json_error(
            StatusCode::BAD_REQUEST,
            "步数范围无效",
            "STEP_RANGE_INVALID",
        );
    }
    let expression = match input.cron_expression {
        Some(value) => match cron::normalize(&value) {
            Some(value) => value,
            None => {
                return json_error(
                    StatusCode::BAD_REQUEST,
                    "Cron 表达式格式或取值无效",
                    "CRON_INVALID",
                );
            }
        },
        None => existing.cron_expression,
    };
    let account_id = input
        .xiaomi_account_id
        .unwrap_or(existing.xiaomi_account_id);
    if !owned_account(&state, &user.id, &account_id).await {
        return json_error(StatusCode::NOT_FOUND, "小米账号不存在", "ACCOUNT_NOT_FOUND");
    }
    let is_active = input
        .is_active
        .unwrap_or(existing.is_active.unwrap_or_default() != 0);
    let now = chrono::Utc::now().timestamp_millis();
    let next_run_at = if is_active {
        cron::next_occurrence(&expression, now)
    } else {
        None
    };
    if let Err(error) = sqlx::query(
        "UPDATE schedules SET xiaomi_account_id = ?, cron_expression = ?, min_step = ?, max_step = ?, is_active = ?, next_run_at = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    )
    .bind(account_id)
    .bind(expression)
    .bind(min_step)
    .bind(max_step)
    .bind(if is_active { 1_i64 } else { 0_i64 })
    .bind(next_run_at)
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
    Query(query): Query<ScheduleQuery>,
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
    let owned = match sqlx::query("SELECT 1 FROM schedules WHERE id = ? AND user_id = ? LIMIT 1")
        .bind(&id)
        .bind(&user.id)
        .fetch_optional(&mut *transaction)
        .await
    {
        Ok(row) => row.is_some(),
        Err(error) => return app_error(error),
    };
    if !owned {
        return json_error(
            StatusCode::NOT_FOUND,
            "定时任务不存在",
            "SCHEDULE_NOT_FOUND",
        );
    }
    if let Err(error) = sqlx::query("DELETE FROM run_logs WHERE schedule_id = ?")
        .bind(&id)
        .execute(&mut *transaction)
        .await
    {
        return app_error(error);
    }
    let deleted = match sqlx::query("DELETE FROM schedules WHERE id = ? AND user_id = ?")
        .bind(&id)
        .bind(user.id)
        .execute(&mut *transaction)
        .await
    {
        Ok(result) => result.rows_affected(),
        Err(error) => return app_error(error),
    };
    if deleted != 1 {
        return json_error(
            StatusCode::NOT_FOUND,
            "定时任务不存在",
            "SCHEDULE_NOT_FOUND",
        );
    }
    if let Err(error) = transaction.commit().await {
        return app_error(error);
    }
    no_store(serde_json::json!({ "success": true }))
}

fn valid_step_range(min_step: i64, max_step: i64) -> bool {
    (1..=200_000).contains(&min_step) && (1..=200_000).contains(&max_step) && min_step <= max_step
}

async fn owned_account(state: &Arc<AppState>, user_id: &str, account_id: &str) -> bool {
    sqlx::query("SELECT 1 FROM xiaomi_accounts WHERE id = ? AND user_id = ? LIMIT 1")
        .bind(account_id)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
        .is_ok_and(|row| row.is_some())
}
