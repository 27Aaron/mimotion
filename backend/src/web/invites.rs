use std::sync::Arc;

use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::Response,
};
use serde::{Deserialize, Serialize};

use crate::{scheduling::cron, state::AppState, storage::models::InviteCodeRow};

use super::common::{app_error, json_error, no_store, require_admin};

#[derive(Debug, Deserialize)]
pub struct DeleteInviteQuery {
    code: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct InviteResponse {
    code: String,
    used_by: Option<String>,
    created_at: String,
}

pub async fn list(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    let admin = match require_admin(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let rows = match sqlx::query_as::<_, InviteCodeRow>(
        "SELECT code, created_by, used_by, created_at FROM invite_codes WHERE created_by = ? ORDER BY created_at DESC, code DESC",
    )
    .bind(&admin.id)
    .fetch_all(&state.db)
    .await
    {
        Ok(rows) => rows,
        Err(error) => return app_error(error),
    };

    no_store(
        rows.into_iter()
            .map(|row| InviteResponse {
                code: row.code,
                used_by: row.used_by,
                created_at: cron::timestamp_to_iso(Some(row.created_at))
                    .unwrap_or_else(|| row.created_at.to_string()),
            })
            .collect::<Vec<_>>(),
    )
}

pub async fn create(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    let admin = match require_admin(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let code = uuid::Uuid::new_v4().simple().to_string()[..8].to_ascii_uppercase();
    let now = chrono::Utc::now().timestamp_millis();
    if let Err(error) =
        sqlx::query("INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, ?, ?)")
            .bind(&code)
            .bind(&admin.id)
            .bind(now)
            .execute(&state.db)
            .await
    {
        return app_error(error);
    }
    no_store(serde_json::json!({ "code": code }))
}

pub async fn delete(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<DeleteInviteQuery>,
) -> Response {
    let admin = match require_admin(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let Some(code) = query.code.filter(|value| !value.is_empty()) else {
        return json_error(StatusCode::BAD_REQUEST, "缺少 code", "MISSING_CODE");
    };

    let row =
        match sqlx::query("SELECT used_by FROM invite_codes WHERE code = ? AND created_by = ?")
            .bind(&code)
            .bind(&admin.id)
            .fetch_optional(&state.db)
            .await
        {
            Ok(Some(row)) => row,
            Ok(None) => {
                return json_error(StatusCode::NOT_FOUND, "邀请码不存在", "CODE_NOT_FOUND");
            }
            Err(error) => return app_error(error),
        };
    let used_by: Option<String> = match sqlx::Row::try_get(&row, "used_by") {
        Ok(value) => value,
        Err(error) => return app_error(error),
    };
    if used_by.is_some() {
        return json_error(
            StatusCode::BAD_REQUEST,
            "只能删除未使用的邀请码",
            "CODE_ONLY_DELETE_UNUSED",
        );
    }

    match sqlx::query("DELETE FROM invite_codes WHERE code = ? AND created_by = ?")
        .bind(code)
        .bind(&admin.id)
        .execute(&state.db)
        .await
    {
        Ok(_) => no_store(serde_json::json!({ "success": true })),
        Err(error) => app_error(error),
    }
}
