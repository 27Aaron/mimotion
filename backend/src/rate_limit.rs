use sqlx::{Row, SqlitePool};

#[derive(Debug, Clone, Copy)]
pub struct RateLimit {
    pub allowed: bool,
    pub remaining: i64,
    pub reset_at: i64,
}

pub async fn check(
    pool: &SqlitePool,
    key: &str,
    max_requests: i64,
    window_ms: i64,
    now: i64,
) -> Result<RateLimit, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    sqlx::query("DELETE FROM rate_limits WHERE reset_at <= ?")
        .bind(now)
        .execute(&mut *transaction)
        .await?;

    let row = sqlx::query("SELECT count, reset_at FROM rate_limits WHERE key = ?")
        .bind(key)
        .fetch_optional(&mut *transaction)
        .await?;

    let result = if let Some(row) = row {
        let count: i64 = row.try_get("count")?;
        let reset_at: i64 = row.try_get("reset_at")?;
        if count >= max_requests {
            RateLimit {
                allowed: false,
                remaining: 0,
                reset_at,
            }
        } else {
            let next_count = count + 1;
            sqlx::query("UPDATE rate_limits SET count = ? WHERE key = ?")
                .bind(next_count)
                .bind(key)
                .execute(&mut *transaction)
                .await?;
            RateLimit {
                allowed: true,
                remaining: (max_requests - next_count).max(0),
                reset_at,
            }
        }
    } else {
        let reset_at = now + window_ms;
        sqlx::query("INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)")
            .bind(key)
            .bind(reset_at)
            .execute(&mut *transaction)
            .await?;
        RateLimit {
            allowed: true,
            remaining: (max_requests - 1).max(0),
            reset_at,
        }
    };

    transaction.commit().await?;
    Ok(result)
}
