#[derive(Debug, sqlx::FromRow)]
pub struct UserRow {
    pub id: String,
    pub username: String,
    pub password_hash: String,
    pub is_admin: Option<i64>,
    pub locale: Option<String>,
    pub bark_url: Option<String>,
    pub bark_url_data: Option<String>,
    pub bark_url_iv: Option<String>,
    pub telegram_bot_token: Option<String>,
    pub telegram_bot_token_data: Option<String>,
    pub telegram_bot_token_iv: Option<String>,
    pub telegram_chat_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, sqlx::FromRow)]
pub struct XiaomiAccountRow {
    pub id: String,
    pub user_id: String,
    pub xiaomi_user_id: Option<String>,
    pub account: Option<String>,
    pub token_data: String,
    pub token_iv: Option<String>,
    pub login_token_data: Option<String>,
    pub login_token_iv: Option<String>,
    pub password_data: Option<String>,
    pub password_iv: Option<String>,
    pub device_id: Option<String>,
    pub nickname: Option<String>,
    pub status: Option<String>,
    pub last_sync_at: Option<i64>,
    pub last_error: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, sqlx::FromRow)]
pub struct ScheduleRow {
    pub id: String,
    pub user_id: String,
    pub xiaomi_account_id: String,
    pub cron_expression: String,
    pub min_step: i64,
    pub max_step: i64,
    pub is_active: Option<i64>,
    pub last_run_at: Option<i64>,
    pub next_run_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, sqlx::FromRow)]
pub struct RunLogRow {
    pub id: String,
    pub schedule_id: String,
    pub executed_at: i64,
    pub step_written: Option<i64>,
    pub status: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
pub struct InviteCodeRow {
    pub code: String,
    pub created_by: String,
    pub used_by: Option<String>,
    pub created_at: i64,
}
