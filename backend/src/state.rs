use std::sync::Arc;
use std::time::Duration;

use anyhow::Context;
use reqwest::redirect::Policy;
use sqlx::SqlitePool;

use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub db: SqlitePool,
    pub http: reqwest::Client,
}

impl AppState {
    pub fn new(config: Arc<Config>, db: SqlitePool) -> anyhow::Result<Self> {
        let http = reqwest::Client::builder()
            .redirect(Policy::none())
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(30))
            .user_agent(concat!("mimotion/", env!("CARGO_PKG_VERSION")))
            .build()
            .context("创建 HTTP 客户端失败")?;
        Ok(Self { config, db, http })
    }
}
