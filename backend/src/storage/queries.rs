use sqlx::SqlitePool;

use crate::storage::models::{ScheduleRow, UserRow, XiaomiAccountRow};

const USER_COLUMNS: &str = "id, username, password_hash, is_admin, locale, bark_url, bark_url_data, bark_url_iv, telegram_bot_token, telegram_bot_token_data, telegram_bot_token_iv, telegram_chat_id";
const XIAOMI_ACCOUNT_COLUMNS: &str = "id, user_id, xiaomi_user_id, account, token_data, token_iv, login_token_data, login_token_iv, password_data, password_iv, device_id, nickname, status, last_sync_at, last_error, created_at, updated_at";
const SCHEDULE_COLUMNS: &str =
    "id, user_id, xiaomi_account_id, cron_expression, min_step, max_step, is_active";

pub async fn find_user_by_id(pool: &SqlitePool, id: &str) -> Result<Option<UserRow>, sqlx::Error> {
    sqlx::query_as::<_, UserRow>(&format!(
        "SELECT {USER_COLUMNS} FROM users WHERE id = ? LIMIT 1"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn find_user_by_username(
    pool: &SqlitePool,
    username: &str,
) -> Result<Option<UserRow>, sqlx::Error> {
    sqlx::query_as::<_, UserRow>(&format!(
        "SELECT {USER_COLUMNS} FROM users WHERE username = ? LIMIT 1"
    ))
    .bind(username)
    .fetch_optional(pool)
    .await
}

pub async fn find_accounts_by_user(
    pool: &SqlitePool,
    user_id: &str,
) -> Result<Vec<XiaomiAccountRow>, sqlx::Error> {
    sqlx::query_as::<_, XiaomiAccountRow>(&format!(
        "SELECT {XIAOMI_ACCOUNT_COLUMNS} FROM xiaomi_accounts WHERE user_id = ? ORDER BY created_at ASC, id ASC"
    ))
    .bind(user_id)
    .fetch_all(pool)
    .await
}

pub async fn find_account_for_user(
    pool: &SqlitePool,
    id: &str,
    user_id: &str,
) -> Result<Option<XiaomiAccountRow>, sqlx::Error> {
    sqlx::query_as::<_, XiaomiAccountRow>(&format!(
        "SELECT {XIAOMI_ACCOUNT_COLUMNS} FROM xiaomi_accounts WHERE id = ? AND user_id = ? LIMIT 1"
    ))
    .bind(id)
    .bind(user_id)
    .fetch_optional(pool)
    .await
}

pub async fn find_account_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<XiaomiAccountRow>, sqlx::Error> {
    sqlx::query_as::<_, XiaomiAccountRow>(&format!(
        "SELECT {XIAOMI_ACCOUNT_COLUMNS} FROM xiaomi_accounts WHERE id = ? LIMIT 1"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn find_schedule_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<ScheduleRow>, sqlx::Error> {
    sqlx::query_as::<_, ScheduleRow>(&format!(
        "SELECT {SCHEDULE_COLUMNS} FROM schedules WHERE id = ? LIMIT 1"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn find_schedule_owned(
    pool: &SqlitePool,
    id: &str,
    user_id: &str,
) -> Result<Option<ScheduleRow>, sqlx::Error> {
    sqlx::query_as::<_, ScheduleRow>(&format!(
        "SELECT {SCHEDULE_COLUMNS} FROM schedules WHERE id = ? AND user_id = ? LIMIT 1"
    ))
    .bind(id)
    .bind(user_id)
    .fetch_optional(pool)
    .await
}

pub async fn find_active_schedules(pool: &SqlitePool) -> Result<Vec<ScheduleRow>, sqlx::Error> {
    sqlx::query_as::<_, ScheduleRow>(&format!(
        "SELECT {SCHEDULE_COLUMNS} FROM schedules WHERE is_active = 1 ORDER BY created_at ASC, id ASC"
    ))
    .fetch_all(pool)
    .await
}
