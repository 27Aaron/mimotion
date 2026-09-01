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
    let migration_count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM _mimotion_migrations")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(migration_count, 1);
}
