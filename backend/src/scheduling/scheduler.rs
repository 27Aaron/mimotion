use std::{sync::Arc, time::Duration};

use futures_util::future::join_all;
use rand::Rng;
use sqlx::{Row, SqlitePool};
use tokio_util::sync::CancellationToken;

use crate::{
    notifications::{self, PushMessage},
    scheduling::cron,
    state::AppState,
    storage::models::{ScheduleRow, XiaomiAccountRow},
    storage::queries::{
        find_account_by_id, find_active_schedules, find_schedule_by_id, find_user_by_id,
    },
    util::now_ms,
    xiaomi::{self, AccountSyncResult, StoredXiaomiCredentials, ZeppErrorCode},
};

const DEFAULT_POLL_INTERVAL_MS: u64 = 10_000;
const DEFAULT_CONCURRENCY: usize = 3;
const MAX_ATTEMPTS: i64 = 3;
const STALE_EXECUTION_MS: i64 = 5 * 60 * 1000;

#[derive(Clone)]
pub struct Scheduler {
    state: Arc<AppState>,
}

#[derive(Debug, Clone)]
struct ClaimedExecution {
    id: String,
    schedule_id: String,
    xiaomi_account_id: String,
    attempt: i64,
    target_step: Option<i64>,
}

#[derive(Debug, Clone)]
struct ExecutionResult {
    status: &'static str,
    execution_id: String,
    step: Option<i64>,
    error_code: Option<String>,
}

impl Scheduler {
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    pub async fn run(self, stop: CancellationToken) {
        let poll_interval = positive_env("WORKER_POLL_INTERVAL_MS", DEFAULT_POLL_INTERVAL_MS);
        let concurrency = positive_env("WORKER_CONCURRENCY", DEFAULT_CONCURRENCY as u64) as usize;
        let mut interval = tokio::time::interval(Duration::from_millis(poll_interval));
        tracing::info!(
            poll_interval_ms = poll_interval,
            concurrency,
            event = "scheduler_started"
        );

        loop {
            tokio::select! {
                _ = stop.cancelled() => break,
                _ = interval.tick() => {
                    self.tick(concurrency).await;
                }
            }
        }
        tracing::info!(event = "scheduler_stopped");
    }

    async fn tick(&self, concurrency: usize) {
        let now = now_ms();
        let recovered = match recover_stale(&self.state.db, now).await {
            Ok(value) => value,
            Err(error) => {
                tracing::error!(%error, event = "scheduler_recovery_failed");
                return;
            }
        };
        let enqueued = match enqueue_current_minute(&self.state.db, now).await {
            Ok(value) => value,
            Err(error) => {
                tracing::error!(%error, event = "scheduler_enqueue_failed");
                return;
            }
        };
        let processed = self.process_pending(now, concurrency).await;
        if recovered.0 != 0 || recovered.1 != 0 || enqueued != 0 || processed != 0 {
            tracing::info!(
                requeued = recovered.0,
                failed = recovered.1,
                enqueued,
                processed,
                event = "scheduler_tick"
            );
        }
    }

    async fn process_pending(&self, now: i64, concurrency: usize) -> usize {
        let mut claimed = Vec::with_capacity(concurrency);
        for _ in 0..concurrency {
            match claim_next(&self.state.db, now).await {
                Ok(Some(execution)) => claimed.push(execution),
                Ok(None) => break,
                Err(error) => {
                    tracing::error!(%error, event = "scheduler_claim_failed");
                    break;
                }
            }
        }
        let count = claimed.len();
        let tasks = claimed
            .into_iter()
            .map(|execution| self.run_claimed(execution));
        for result in join_all(tasks).await {
            tracing::info!(
                status = result.status,
                execution_id = %result.execution_id,
                step = ?result.step,
                error_code = ?result.error_code,
                event = "execution_finished"
            );
        }
        count
    }

    async fn run_claimed(&self, execution: ClaimedExecution) -> ExecutionResult {
        let schedule = find_schedule_by_id(&self.state.db, &execution.schedule_id).await;
        let account = find_account_by_id(&self.state.db, &execution.xiaomi_account_id).await;

        let (schedule, account) = match (schedule, account) {
            (Ok(Some(schedule)), Ok(Some(account))) if schedule.user_id == account.user_id => {
                (schedule, account)
            }
            _ => {
                let _ = finalize_running_execution(
                    &self.state.db,
                    &execution.id,
                    "failed",
                    now_ms(),
                    execution.target_step,
                    Some("INVALID_EXECUTION_DATA"),
                    Some("Schedule or Xiaomi account no longer exists or ownership does not match"),
                )
                .await;
                return ExecutionResult {
                    status: "discarded",
                    execution_id: execution.id,
                    step: execution.target_step,
                    error_code: Some("INVALID_EXECUTION_DATA".to_owned()),
                };
            }
        };

        let step = match execution.target_step {
            Some(step) => step,
            None => {
                let step = random_step(schedule.min_step, schedule.max_step);
                match set_target_step(&self.state.db, &execution.id, step, now_ms()).await {
                    Ok(value) => value,
                    Err(error) => {
                        tracing::error!(%error, execution_id = %execution.id, event = "target_step_failed");
                        return ExecutionResult {
                            status: "failed",
                            execution_id: execution.id,
                            step: None,
                            error_code: Some("TARGET_STEP_FAILED".to_owned()),
                        };
                    }
                }
            }
        };

        let credentials = StoredXiaomiCredentials::from(&account);
        let sync_result =
            xiaomi::sync_account(&self.state.config, &self.state.http, &credentials, step).await;
        if let Some(update) = &sync_result.credential_update
            && let Err(error) = persist_credentials(&self.state.db, &account.id, update).await
        {
            tracing::error!(%error, account_id = %account.id, event = "credential_update_failed");
        }

        let error_code = sync_result
            .set_step
            .error_code
            .map(error_code_name)
            .map(str::to_owned);
        let error_message = sync_result.set_step.error.clone();
        let completed_at = now_ms();
        if !sync_result.set_step.success
            && sync_result.set_step.retryable
            && execution.attempt < MAX_ATTEMPTS
        {
            if let Err(error) = retry_execution(
                &self.state.db,
                &execution.id,
                completed_at,
                error_code.as_deref().unwrap_or("RETRYABLE_ERROR"),
                error_message
                    .as_deref()
                    .unwrap_or("Retryable execution error"),
            )
            .await
            {
                tracing::error!(%error, execution_id = %execution.id, event = "execution_retry_failed");
            }
            return ExecutionResult {
                status: "retrying",
                execution_id: execution.id,
                step: Some(step),
                error_code,
            };
        }

        let status = if sync_result.set_step.success {
            "succeeded"
        } else {
            "failed"
        };
        let next_run_at = cron::next_occurrence(&schedule.cron_expression, completed_at);
        if let Err(error) = finish_success_or_failure(
            &self.state.db,
            &execution,
            &schedule,
            &account,
            Completion {
                status,
                step,
                now: completed_at,
                next_run_at,
                error_code: error_code.as_deref(),
                error_message: error_message.as_deref(),
            },
        )
        .await
        {
            tracing::error!(%error, execution_id = %execution.id, event = "execution_persist_failed");
            return ExecutionResult {
                status: "failed",
                execution_id: execution.id,
                step: Some(step),
                error_code: Some("PERSIST_FAILED".to_owned()),
            };
        }

        notify_result(
            &self.state,
            &schedule,
            step,
            &sync_result,
            error_message.as_deref(),
        )
        .await;

        ExecutionResult {
            status,
            execution_id: execution.id,
            step: Some(step),
            error_code,
        }
    }
}

async fn enqueue_current_minute(pool: &SqlitePool, now: i64) -> Result<u64, sqlx::Error> {
    let slot = now - now.rem_euclid(60_000);
    let schedules = find_active_schedules(pool).await?;
    let mut enqueued = 0;
    for schedule in schedules {
        if !cron::matches(&schedule.cron_expression, slot) {
            continue;
        }
        let result = sqlx::query(
            "INSERT OR IGNORE INTO run_executions (id, schedule_id, xiaomi_account_id, scheduled_for, status, attempt, claimed_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, ?)",
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(schedule.id)
        .bind(schedule.xiaomi_account_id)
        .bind(slot)
        .bind(now)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;
        enqueued += result.rows_affected();
    }
    Ok(enqueued)
}

async fn recover_stale(pool: &SqlitePool, now: i64) -> Result<(u64, u64), sqlx::Error> {
    let stale_before = now - STALE_EXECUTION_MS;
    let mut transaction = pool.begin().await?;
    let requeued = sqlx::query(
        "UPDATE run_executions SET status = 'pending', started_at = NULL, updated_at = ?, error_code = 'WORKER_TIMEOUT', error_message = 'Worker stopped before finishing the execution' WHERE status = 'running' AND updated_at < ? AND attempt < ?",
    )
    .bind(now)
    .bind(stale_before)
    .bind(MAX_ATTEMPTS)
    .execute(&mut *transaction)
    .await?
    .rows_affected();
    let failed = sqlx::query(
        "UPDATE run_executions SET status = 'failed', finished_at = ?, updated_at = ?, error_code = 'WORKER_TIMEOUT', error_message = 'Execution exceeded the retry limit after worker timeouts' WHERE status = 'running' AND updated_at < ? AND attempt >= ?",
    )
    .bind(now)
    .bind(now)
    .bind(stale_before)
    .bind(MAX_ATTEMPTS)
    .execute(&mut *transaction)
    .await?
    .rows_affected();
    transaction.commit().await?;
    Ok((requeued, failed))
}

async fn claim_next(pool: &SqlitePool, now: i64) -> Result<Option<ClaimedExecution>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let row = sqlx::query(
        "SELECT candidate.id, candidate.schedule_id, candidate.xiaomi_account_id, candidate.attempt, candidate.target_step FROM run_executions candidate WHERE candidate.status = 'pending' AND candidate.attempt < ? AND NOT EXISTS (SELECT 1 FROM run_executions running WHERE running.xiaomi_account_id = candidate.xiaomi_account_id AND running.status = 'running') ORDER BY candidate.scheduled_for ASC, candidate.created_at ASC LIMIT 1",
    )
    .bind(MAX_ATTEMPTS)
    .fetch_optional(&mut *transaction)
    .await?;
    let Some(row) = row else {
        transaction.commit().await?;
        return Ok(None);
    };
    let id: String = row.try_get("id")?;
    let schedule_id: String = row.try_get("schedule_id")?;
    let xiaomi_account_id: String = row.try_get("xiaomi_account_id")?;
    let attempt: i64 = row.try_get("attempt")?;
    let target_step: Option<i64> = row.try_get("target_step")?;
    let changed = sqlx::query(
        "UPDATE run_executions SET status = 'running', attempt = attempt + 1, started_at = ?, updated_at = ?, error_code = NULL, error_message = NULL WHERE id = ? AND status = 'pending' AND NOT EXISTS (SELECT 1 FROM run_executions running WHERE running.xiaomi_account_id = ? AND running.status = 'running' AND running.id <> ?)",
    )
    .bind(now)
    .bind(now)
    .bind(&id)
    .bind(&xiaomi_account_id)
    .bind(&id)
    .execute(&mut *transaction)
    .await?
    .rows_affected();
    transaction.commit().await?;
    if changed != 1 {
        return Ok(None);
    }
    Ok(Some(ClaimedExecution {
        id,
        schedule_id,
        xiaomi_account_id,
        attempt: attempt + 1,
        target_step,
    }))
}

async fn set_target_step(
    pool: &SqlitePool,
    execution_id: &str,
    target_step: i64,
    now: i64,
) -> Result<i64, sqlx::Error> {
    sqlx::query(
        "UPDATE run_executions SET target_step = COALESCE(target_step, ?), updated_at = ? WHERE id = ?",
    )
    .bind(target_step)
    .bind(now)
    .bind(execution_id)
    .execute(pool)
    .await?;
    sqlx::query_scalar("SELECT target_step FROM run_executions WHERE id = ?")
        .bind(execution_id)
        .fetch_one(pool)
        .await
}

async fn retry_execution(
    pool: &SqlitePool,
    execution_id: &str,
    now: i64,
    error_code: &str,
    error_message: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE run_executions SET status = 'pending', started_at = NULL, updated_at = ?, error_code = ?, error_message = ? WHERE id = ? AND status = 'running'",
    )
    .bind(now)
    .bind(error_code)
    .bind(error_message)
    .bind(execution_id)
    .execute(pool)
    .await?;
    Ok(())
}

async fn finalize_running_execution<'e, E: sqlx::Executor<'e, Database = sqlx::Sqlite>>(
    executor: E,
    execution_id: &str,
    status: &str,
    now: i64,
    target_step: Option<i64>,
    error_code: Option<&str>,
    error_message: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE run_executions SET status = ?, target_step = COALESCE(target_step, ?), finished_at = ?, updated_at = ?, error_code = ?, error_message = ? WHERE id = ? AND status = 'running'",
    )
    .bind(status)
    .bind(target_step)
    .bind(now)
    .bind(now)
    .bind(error_code)
    .bind(error_message)
    .bind(execution_id)
    .execute(executor)
    .await?;
    Ok(())
}

async fn finish_success_or_failure(
    pool: &SqlitePool,
    execution: &ClaimedExecution,
    schedule: &ScheduleRow,
    account: &XiaomiAccountRow,
    completion: Completion<'_>,
) -> Result<(), sqlx::Error> {
    let mut transaction = pool.begin().await?;
    finalize_running_execution(
        &mut *transaction,
        &execution.id,
        completion.status,
        completion.now,
        Some(completion.step),
        completion.error_code,
        completion.error_message,
    )
    .await?;
    sqlx::query(
        "INSERT INTO run_logs (id, schedule_id, executed_at, step_written, status, error_message) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&schedule.id)
    .bind(completion.now)
    .bind((completion.status == "succeeded").then_some(completion.step))
    .bind(if completion.status == "succeeded" {
        "success"
    } else {
        "failed"
    })
    .bind(completion.error_message)
    .execute(&mut *transaction)
    .await?;
    sqlx::query(
        "UPDATE schedules SET last_run_at = ?, next_run_at = ?, updated_at = ? WHERE id = ?",
    )
    .bind(completion.now)
    .bind(completion.next_run_at)
    .bind(completion.now)
    .bind(&schedule.id)
    .execute(&mut *transaction)
    .await?;
    sqlx::query(
        "UPDATE xiaomi_accounts SET last_sync_at = ?, status = ?, last_error = ?, updated_at = ? WHERE id = ?",
    )
    .bind(completion.now)
    .bind(if completion.status == "succeeded" {
        "active"
    } else {
        "error"
    })
    .bind(if completion.status == "succeeded" {
        None
    } else {
        completion.error_message
    })
    .bind(completion.now)
    .bind(&account.id)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(())
}

struct Completion<'a> {
    status: &'a str,
    step: i64,
    now: i64,
    next_run_at: Option<i64>,
    error_code: Option<&'a str>,
    error_message: Option<&'a str>,
}

async fn persist_credentials(
    pool: &SqlitePool,
    account_id: &str,
    update: &xiaomi::CredentialUpdate,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE xiaomi_accounts SET token_data = ?, token_iv = ?, login_token_data = COALESCE(?, login_token_data), login_token_iv = COALESCE(?, login_token_iv), password_data = COALESCE(?, password_data), password_iv = COALESCE(?, password_iv), device_id = COALESCE(?, device_id), xiaomi_user_id = COALESCE(?, xiaomi_user_id), updated_at = ? WHERE id = ?",
    )
    .bind(&update.token_data)
    .bind(&update.token_iv)
    .bind(&update.login_token_data)
    .bind(&update.login_token_iv)
    .bind(&update.password_data)
    .bind(&update.password_iv)
    .bind(&update.device_id)
    .bind(&update.xiaomi_user_id)
    .bind(now_ms())
    .bind(account_id)
    .execute(pool)
    .await?;
    Ok(())
}

async fn notify_result(
    state: &Arc<AppState>,
    schedule: &ScheduleRow,
    step: i64,
    result: &AccountSyncResult,
    error: Option<&str>,
) {
    let Ok(Some(user)) = find_user_by_id(&state.db, &schedule.user_id).await else {
        return;
    };
    let secrets = match notifications::decrypt_user_secrets(&state.config, &user) {
        Ok(secrets) => secrets,
        Err(error) => {
            tracing::warn!(%error, event = "notification_config_failed");
            return;
        }
    };
    let zh = user.locale.as_deref() != Some("en");
    let (subtitle, body) = if result.set_step.success {
        (
            if zh { "刷步成功" } else { "Steps updated" },
            if zh {
                format!("已设置步数: {step}")
            } else {
                format!("Steps set to {step}")
            },
        )
    } else if result.token_expired {
        (
            if zh {
                "登录凭证已过期"
            } else {
                "Credentials expired"
            },
            if zh {
                "请重新绑定小米账号以继续刷步".to_owned()
            } else {
                "Please reconnect the Xiaomi account.".to_owned()
            },
        )
    } else {
        (
            if zh {
                "刷步失败"
            } else {
                "Step update failed"
            },
            error
                .unwrap_or(if zh { "同步失败" } else { "Sync failed" })
                .to_owned(),
        )
    };
    let message = PushMessage {
        title: "MiMotion",
        body: &body,
        subtitle: Some(subtitle),
    };
    let bark = async {
        if let Some(url) = secrets.bark_url.as_deref() {
            notifications::send_bark(&state.http, url, &message)
                .await
                .ok();
        }
    };
    let telegram = async {
        if let (Some(token), Some(chat_id)) = (
            secrets.telegram_bot_token.as_deref(),
            secrets.telegram_chat_id.as_deref(),
        ) {
            notifications::send_telegram(&state.http, token, chat_id, &message)
                .await
                .ok();
        }
    };
    tokio::join!(bark, telegram);
}

fn random_step(min: i64, max: i64) -> i64 {
    rand::rng().random_range(min..=max)
}

fn positive_env<T>(name: &str, fallback: T) -> T
where
    T: std::str::FromStr + Copy + PartialOrd + Default,
{
    std::env::var(name)
        .ok()
        .and_then(|value| value.parse::<T>().ok())
        .filter(|value| value > &T::default())
        .unwrap_or(fallback)
}

fn error_code_name(code: ZeppErrorCode) -> &'static str {
    match code {
        ZeppErrorCode::TokenExpired => "TOKEN_EXPIRED",
        ZeppErrorCode::RateLimited => "RATE_LIMITED",
        ZeppErrorCode::NetworkError => "NETWORK_ERROR",
        ZeppErrorCode::RemoteError => "REMOTE_ERROR",
        ZeppErrorCode::ProtocolError => "PROTOCOL_ERROR",
    }
}
