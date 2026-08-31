use std::sync::Arc;

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::Response,
};
use chrono::{Datelike, TimeZone, Utc};
use chrono_tz::Asia::Shanghai;
use serde::Serialize;
use sqlx::Row;

use crate::state::AppState;

use super::common::{app_error, json_error, no_store, require_user};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DashboardResponse {
    account_count: i64,
    active_account_count: i64,
    schedule_count: i64,
    active_schedule_count: i64,
    today_total: i64,
    today_success: i64,
    recent_logs: Vec<DashboardLog>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DashboardLog {
    id: String,
    executed_at: String,
    step_written: Option<i64>,
    status: Option<String>,
    error_message: Option<String>,
}

pub async fn get(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };

    let counts = match sqlx::query(
        "SELECT (SELECT COUNT(*) FROM xiaomi_accounts WHERE user_id = ?) AS account_count, (SELECT COUNT(*) FROM xiaomi_accounts WHERE user_id = ? AND status = 'active') AS active_account_count, (SELECT COUNT(*) FROM schedules WHERE user_id = ?) AS schedule_count, (SELECT COUNT(*) FROM schedules WHERE user_id = ? AND is_active = 1) AS active_schedule_count",
    )
    .bind(&user.id)
    .bind(&user.id)
    .bind(&user.id)
    .bind(&user.id)
    .fetch_one(&state.db)
    .await
    {
        Ok(row) => row,
        Err(error) => return app_error(error),
    };

    let today_start = today_start_ms();
    let stats = match sqlx::query(
        "SELECT COUNT(*) AS today_total, COALESCE(SUM(CASE WHEN rl.status = 'success' THEN 1 ELSE 0 END), 0) AS today_success FROM run_logs rl JOIN schedules s ON s.id = rl.schedule_id WHERE s.user_id = ? AND rl.executed_at >= ?",
    )
    .bind(&user.id)
    .bind(today_start)
    .fetch_one(&state.db)
    .await
    {
        Ok(row) => row,
        Err(error) => return app_error(error),
    };

    let logs = match sqlx::query(
        "SELECT rl.id, rl.executed_at, rl.step_written, rl.status, rl.error_message FROM run_logs rl JOIN schedules s ON s.id = rl.schedule_id WHERE s.user_id = ? ORDER BY rl.executed_at DESC, rl.id DESC LIMIT 20",
    )
    .bind(&user.id)
    .fetch_all(&state.db)
    .await
    {
        Ok(rows) => rows,
        Err(error) => return app_error(error),
    };

    let recent_logs = logs
        .into_iter()
        .map(|row| DashboardLog {
            id: row.get("id"),
            executed_at: crate::scheduling::cron::timestamp_to_iso(Some(row.get("executed_at")))
                .unwrap_or_else(|| row.get::<i64, _>("executed_at").to_string()),
            step_written: row.get("step_written"),
            status: row.get("status"),
            error_message: row.get("error_message"),
        })
        .collect();

    no_store(DashboardResponse {
        account_count: counts.get("account_count"),
        active_account_count: counts.get("active_account_count"),
        schedule_count: counts.get("schedule_count"),
        active_schedule_count: counts.get("active_schedule_count"),
        today_total: stats.get("today_total"),
        today_success: stats.get("today_success"),
        recent_logs,
    })
}

fn today_start_ms() -> i64 {
    let now = Utc::now().with_timezone(&Shanghai);
    Shanghai
        .with_ymd_and_hms(now.year(), now.month(), now.day(), 0, 0, 0)
        .single()
        .expect("Asia/Shanghai midnight is unambiguous")
        .with_timezone(&Utc)
        .timestamp_millis()
}

#[allow(dead_code)]
fn _missing_route() -> Response {
    json_error(StatusCode::NOT_FOUND, "页面不存在", "NOT_FOUND")
}
