use std::time::{SystemTime, UNIX_EPOCH};

use axum::http::{HeaderMap, header};
use bcrypt::{DEFAULT_COST, hash, verify};
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::{config::Config, storage::models::UserRow};

pub const AUTH_COOKIE_NAME: &str = "auth_token";
const JWT_ISSUER: &str = "mimotion";
const JWT_AUDIENCE: &str = "mimotion-web";
const SESSION_SECONDS: u64 = 24 * 60 * 60;

#[derive(Clone, Debug)]
pub struct AuthUser {
    pub id: String,
    pub username: String,
    pub is_admin: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Claims {
    #[serde(rename = "userId")]
    pub user_id: String,
    pub username: String,
    #[serde(rename = "isAdmin")]
    pub is_admin: bool,
    pub iss: String,
    pub aud: String,
    pub iat: usize,
    pub exp: usize,
}

pub async fn hash_password(password: String) -> anyhow::Result<String> {
    tokio::task::spawn_blocking(move || hash(password, DEFAULT_COST))
        .await
        .map_err(|error| anyhow::anyhow!("密码哈希任务失败: {error}"))?
        .map_err(|error| anyhow::anyhow!("密码哈希失败: {error}"))
}

pub async fn verify_password(password: String, password_hash: String) -> anyhow::Result<bool> {
    tokio::task::spawn_blocking(move || verify(password, &password_hash))
        .await
        .map_err(|error| anyhow::anyhow!("密码校验任务失败: {error}"))?
        .map_err(|error| anyhow::anyhow!("密码校验失败: {error}"))
}

pub fn create_token(config: &Config, user: &UserRow) -> anyhow::Result<String> {
    let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs() as usize;
    let claims = Claims {
        user_id: user.id.clone(),
        username: user.username.clone(),
        is_admin: user.is_admin.unwrap_or_default() != 0,
        iss: JWT_ISSUER.to_owned(),
        aud: JWT_AUDIENCE.to_owned(),
        iat: now,
        exp: now + SESSION_SECONDS as usize,
    };
    encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(config.jwt_secret.as_bytes()),
    )
    .map_err(|error| anyhow::anyhow!("创建登录令牌失败: {error}"))
}

pub fn verify_token(config: &Config, token: &str) -> Option<Claims> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.set_issuer(&[JWT_ISSUER]);
    validation.set_audience(&[JWT_AUDIENCE]);
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(config.jwt_secret.as_bytes()),
        &validation,
    )
    .ok()
    .map(|data| data.claims)
}

pub async fn current_user(
    config: &Config,
    pool: &SqlitePool,
    headers: &HeaderMap,
) -> Option<AuthUser> {
    let token = cookie_value(headers, AUTH_COOKIE_NAME)?;
    let claims = verify_token(config, token)?;
    let (id, username, is_admin) = sqlx::query_as::<_, (String, String, Option<i64>)>(
        "SELECT id, username, is_admin FROM users WHERE id = ? LIMIT 1",
    )
    .bind(claims.user_id)
    .fetch_optional(pool)
    .await
    .ok()??;

    Some(AuthUser {
        id,
        username,
        is_admin: is_admin.unwrap_or_default() != 0,
    })
}

pub fn cookie_value<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers
        .get_all(header::COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(';'))
        .filter_map(|item| item.trim().split_once('='))
        .find_map(|(cookie_name, cookie_value)| (cookie_name == name).then_some(cookie_value))
}

pub fn session_cookie(token: &str, secure: bool) -> String {
    let secure_suffix = if secure { "; Secure" } else { "" };
    format!(
        "{AUTH_COOKIE_NAME}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={SESSION_SECONDS}{secure_suffix}"
    )
}

pub fn expired_session_cookie(secure: bool) -> String {
    let secure_suffix = if secure { "; Secure" } else { "" };
    format!("{AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0{secure_suffix}")
}
