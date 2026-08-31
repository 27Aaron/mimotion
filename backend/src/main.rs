#![forbid(unsafe_code)]

use std::sync::Arc;

use anyhow::Context;
use mimotion::scheduler::Scheduler;
use mimotion::{config::Config, db, state::AppState, web};
use tokio::net::TcpListener;
use tokio_util::sync::CancellationToken;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    init_tracing();

    let config = Arc::new(Config::from_env().context("配置无效")?);
    let pool = db::connect_and_migrate(&config)
        .await
        .context("初始化 SQLite 数据库失败")?;
    db::initialize_admin(&config, &pool)
        .await
        .context("初始化管理员失败")?;
    let state = Arc::new(AppState::new(config.clone(), pool).context("初始化应用状态失败")?);

    let listener = TcpListener::bind(config.web_bind_address)
        .await
        .with_context(|| format!("绑定 Web 地址 {} 失败", config.web_bind_address))?;

    tracing::info!(
        address = %config.web_bind_address,
        database = %config.database_path.display(),
        event = "web_server_started"
    );

    let stop = CancellationToken::new();
    let scheduler_task = tokio::spawn(Scheduler::new(state.clone()).run(stop.clone()));
    axum::serve(listener, web::router(state))
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("Web 服务运行失败")?;
    stop.cancel();
    let _ = scheduler_task.await;

    Ok(())
}

fn init_tracing() {
    let filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("off,mimotion=info"));
    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(false)
        .compact()
        .init();
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!(event = "service_shutdown");
}
