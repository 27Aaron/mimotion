use std::time::Duration;

use anyhow::{Context, bail};
use bcrypt::{DEFAULT_COST, hash};
use sha2::{Digest, Sha256};
use sqlx::{
    Row,
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous},
};

use crate::config::Config;

const MIGRATIONS: &[(&str, &str)] = &[
    (
        "0000_baseline.sql",
        include_str!("../../migrations/0000_baseline.sql"),
    ),
    (
        "0001_encrypt_notification_secrets.sql",
        include_str!("../../migrations/0001_encrypt_notification_secrets.sql"),
    ),
    (
        "0002_durable_rate_limits.sql",
        include_str!("../../migrations/0002_durable_rate_limits.sql"),
    ),
    (
        "0003_normalize_timestamps_to_milliseconds.sql",
        include_str!("../../migrations/0003_normalize_timestamps_to_milliseconds.sql"),
    ),
];

pub async fn connect_and_migrate(config: &Config) -> anyhow::Result<sqlx::SqlitePool> {
    let options = SqliteConnectOptions::new()
        .filename(&config.database_path)
        .create_if_missing(true)
        .foreign_keys(true)
        .busy_timeout(Duration::from_secs(5))
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal);

    let pool = SqlitePoolOptions::new()
        .max_connections(8)
        .connect_with(options)
        .await
        .context("连接 SQLite 失败")?;

    apply_legacy_compatible_migrations(&pool).await?;
    Ok(pool)
}

pub async fn initialize_admin(config: &Config, pool: &sqlx::SqlitePool) -> anyhow::Result<()> {
    let existing =
        sqlx::query_scalar::<_, String>("SELECT id FROM users WHERE username = ? LIMIT 1")
            .bind(&config.admin_username)
            .fetch_optional(pool)
            .await?;

    if existing.is_some() {
        return Ok(());
    }

    if config.admin_password == "password" {
        tracing::warn!(
            event = "default_admin_password",
            message = "首次启动仍在使用默认管理员密码，请尽快修改"
        );
    }

    let username = config.admin_username.clone();
    let password = config.admin_password.clone();
    let password_hash = tokio::task::spawn_blocking(move || hash(password, DEFAULT_COST))
        .await
        .map_err(|error| anyhow::anyhow!("管理员密码哈希任务失败: {error}"))?
        .context("管理员密码哈希失败")?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();

    sqlx::query(
        "INSERT INTO users (id, username, password_hash, is_admin, locale, created_at, updated_at) VALUES (?, ?, ?, 1, 'zh', ?, ?)",
    )
    .bind(id)
    .bind(username)
    .bind(password_hash)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await?;

    tracing::info!(username = %config.admin_username, event = "admin_created");
    Ok(())
}

async fn apply_legacy_compatible_migrations(pool: &sqlx::SqlitePool) -> anyhow::Result<()> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS _mimotion_migrations (name TEXT PRIMARY KEY, hash TEXT NOT NULL, applied_at INTEGER NOT NULL)",
    )
    .execute(pool)
    .await
    .context("创建迁移记录表失败")?;

    for (name, sql) in MIGRATIONS {
        let hash = hex::encode(Sha256::digest(sql.as_bytes()));
        let applied = sqlx::query("SELECT hash FROM _mimotion_migrations WHERE name = ?")
            .bind(name)
            .fetch_optional(pool)
            .await
            .with_context(|| format!("读取迁移记录 {name} 失败"))?;

        if let Some(row) = applied {
            let applied_hash: String = row.try_get("hash")?;
            if applied_hash != hash {
                bail!("迁移 {name} 已应用但内容发生变化");
            }
            continue;
        }

        let mut transaction = pool.begin().await?;
        for statement in sql
            .split("--> statement-breakpoint")
            .map(str::trim)
            .filter(|statement| !statement.is_empty())
        {
            sqlx::query(statement)
                .execute(&mut *transaction)
                .await
                .with_context(|| format!("执行迁移 {name} 失败"))?;
        }
        sqlx::query("INSERT INTO _mimotion_migrations (name, hash, applied_at) VALUES (?, ?, ?)")
            .bind(name)
            .bind(hash)
            .bind(chrono::Utc::now().timestamp_millis())
            .execute(&mut *transaction)
            .await
            .with_context(|| format!("记录迁移 {name} 失败"))?;
        transaction.commit().await?;

        tracing::info!(migration = *name, event = "migration_applied");
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use sqlx::{Row, sqlite::SqlitePoolOptions};

    use super::apply_legacy_compatible_migrations;

    #[tokio::test]
    async fn applies_the_legacy_schema_and_is_idempotent() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();

        apply_legacy_compatible_migrations(&pool).await.unwrap();
        apply_legacy_compatible_migrations(&pool).await.unwrap();

        let users =
            sqlx::query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(users.get::<String, _>("name"), "users");
        let migration_count =
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM _mimotion_migrations")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(migration_count, 4);
    }
}
