use std::net::IpAddr;

use anyhow::{Context, bail};
use serde::Serialize;
use sqlx::SqlitePool;
use tokio::net::lookup_host;
use url::Url;

use crate::{config::Config, security::crypto, storage::models::UserRow};

pub const BARK_ICON_URL: &str =
    "https://cdn.jsdelivr.net/gh/27Aaron/mimotion@main/frontend/public/icon.png?v=1";

#[derive(Debug, Clone)]
pub struct NotificationSecrets {
    pub bark_url: Option<String>,
    pub telegram_bot_token: Option<String>,
    pub telegram_chat_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PushMessage<'a> {
    pub title: &'a str,
    pub body: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subtitle: Option<&'a str>,
}

pub async fn get_user_secrets(
    config: &Config,
    pool: &SqlitePool,
    user_id: &str,
) -> anyhow::Result<NotificationSecrets> {
    let row = sqlx::query_as::<_, UserRow>(
        "SELECT id, username, password_hash, is_admin, locale, bark_url, bark_url_data, bark_url_iv, telegram_bot_token, telegram_bot_token_data, telegram_bot_token_iv, telegram_chat_id, created_at, updated_at FROM users WHERE id = ? LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?
    .context("用户不存在")?;

    let bark_url = decrypt_secret(
        config,
        row.bark_url_data.as_deref(),
        row.bark_url_iv.as_deref(),
        row.bark_url.as_deref(),
    )?;
    let telegram_bot_token = decrypt_secret(
        config,
        row.telegram_bot_token_data.as_deref(),
        row.telegram_bot_token_iv.as_deref(),
        row.telegram_bot_token.as_deref(),
    )?;

    Ok(NotificationSecrets {
        bark_url,
        telegram_bot_token,
        telegram_chat_id: row.telegram_chat_id,
    })
}

pub async fn send_bark(
    client: &reqwest::Client,
    url: &str,
    message: &PushMessage<'_>,
) -> anyhow::Result<()> {
    if !is_safe_bark_target(url).await {
        bail!("Bark URL 不安全或格式无效");
    }
    let response = client
        .post(url)
        .json(&serde_json::json!({
            "title": message.title,
            "subtitle": message.subtitle,
            "body": message.body,
            "sound": "fanfare",
            "group": "MiMotion",
            "icon": BARK_ICON_URL,
        }))
        .send()
        .await
        .context("Bark 推送请求失败")?;
    if !response.status().is_success() {
        bail!("Bark 推送失败: HTTP {}", response.status());
    }
    Ok(())
}

pub async fn send_telegram(
    client: &reqwest::Client,
    bot_token: &str,
    chat_id: &str,
    message: &PushMessage<'_>,
) -> anyhow::Result<()> {
    if bot_token.is_empty() || bot_token.len() > 128 || chat_id.is_empty() || chat_id.len() > 64 {
        bail!("Telegram 配置无效");
    }
    let text = format_telegram_message(message);
    let response = client
        .post(format!(
            "https://api.telegram.org/bot{bot_token}/sendMessage"
        ))
        .json(&serde_json::json!({
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "Markdown",
        }))
        .send()
        .await
        .context("Telegram 推送请求失败")?;
    let status = response.status();
    let payload = response
        .json::<serde_json::Value>()
        .await
        .unwrap_or_default();
    if !status.is_success() || payload.get("ok").and_then(serde_json::Value::as_bool) != Some(true)
    {
        bail!(
            "Telegram 推送失败: {}",
            payload
                .get("description")
                .and_then(serde_json::Value::as_str)
                .unwrap_or("未知错误")
        );
    }
    Ok(())
}

pub async fn is_safe_bark_target(value: &str) -> bool {
    let Ok(url) = Url::parse(value) else {
        return false;
    };
    if !matches!(url.scheme(), "http" | "https")
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return false;
    }
    let Some(host) = url.host_str() else {
        return false;
    };
    let normalized = host.trim_matches(['[', ']']).to_ascii_lowercase();
    if normalized == "localhost"
        || normalized.ends_with(".localhost")
        || normalized.ends_with(".local")
    {
        return false;
    }
    if let Ok(address) = normalized.parse::<IpAddr>() {
        return is_public_address(address);
    }

    let port = url.port_or_known_default().unwrap_or(443);
    let Ok(addresses) = lookup_host((normalized.as_str(), port)).await else {
        return false;
    };
    let addresses = addresses.map(|address| address.ip()).collect::<Vec<_>>();
    !addresses.is_empty() && addresses.into_iter().all(is_public_address)
}

fn decrypt_secret(
    config: &Config,
    data: Option<&str>,
    iv: Option<&str>,
    legacy: Option<&str>,
) -> anyhow::Result<Option<String>> {
    match (data, iv) {
        (Some(data), Some(iv)) => Ok(Some(crypto::decrypt(config, data, iv)?)),
        _ => Ok(legacy.map(str::to_owned)),
    }
}

fn is_public_address(address: IpAddr) -> bool {
    match address {
        IpAddr::V4(address) => {
            !address.is_private()
                && !address.is_loopback()
                && !address.is_link_local()
                && !address.is_unspecified()
                && !address.is_broadcast()
                && !address.is_multicast()
                && !is_carrier_grade_v4(address)
                && !is_documentation_v4(address)
                && !is_benchmark_v4(address)
        }
        IpAddr::V6(address) => {
            !address.is_loopback()
                && !address.is_unspecified()
                && !address.is_multicast()
                && !address.is_unique_local()
                && !address.is_unicast_link_local()
        }
    }
}

fn is_carrier_grade_v4(address: std::net::Ipv4Addr) -> bool {
    let octets = address.octets();
    octets[0] == 100 && (64..=127).contains(&octets[1])
}

fn is_documentation_v4(address: std::net::Ipv4Addr) -> bool {
    let octets = address.octets();
    (octets[0] == 192 && octets[1] == 0 && (octets[2] == 0 || octets[2] == 2))
        || (octets[0] == 198 && (51..=52).contains(&octets[1]))
        || (octets[0] == 203 && octets[1] == 0 && octets[2] == 113)
}

fn is_benchmark_v4(address: std::net::Ipv4Addr) -> bool {
    let octets = address.octets();
    octets[0] == 198 && (18..=19).contains(&octets[1])
}

fn escape_markdown(value: &str) -> String {
    value
        .chars()
        .flat_map(|character| {
            if matches!(
                character,
                '_' | '*'
                    | '['
                    | ']'
                    | '('
                    | ')'
                    | '~'
                    | '>'
                    | '#'
                    | '+'
                    | '-'
                    | '='
                    | '|'
                    | '{'
                    | '}'
                    | '.'
                    | '!'
            ) || character == '\u{0060}'
            {
                vec!['\\', character]
            } else {
                vec![character]
            }
        })
        .collect()
}

fn format_telegram_message(message: &PushMessage<'_>) -> String {
    let subtitle = message
        .subtitle
        .map(|value| format!("\n_{}_", escape_markdown(value)))
        .unwrap_or_default();
    format!(
        "*{}*{}\n{}",
        escape_markdown(message.title),
        subtitle,
        escape_markdown(message.body)
    )
}

#[cfg(test)]
mod tests {
    use super::{PushMessage, format_telegram_message};

    #[test]
    fn formats_telegram_message_with_real_line_breaks() {
        let message = PushMessage {
            title: "MiMotion 测试推送",
            body: "如果你看到这条消息，说明 Telegram 推送配置成功！",
            subtitle: None,
        };

        let text = format_telegram_message(&message);

        assert_eq!(
            text,
            "*MiMotion 测试推送*\n如果你看到这条消息，说明 Telegram 推送配置成功！"
        );
        assert!(!text.contains("\\n"));
    }

    #[test]
    fn keeps_subtitle_on_its_own_line() {
        let message = PushMessage {
            title: "Title",
            body: "Body",
            subtitle: Some("Subtitle"),
        };

        assert_eq!(
            format_telegram_message(&message),
            "*Title*\n_Subtitle_\nBody"
        );
    }
}
