use std::time::Duration;

use chrono::{DateTime, Utc};
use chrono_tz::Asia::Shanghai;
use serde_json::Value;

const DATA_JSON_TEMPLATE: &str = include_str!("data_template.txt");
const DEFAULT_DEVICE_ID: &str = "DA932FFFFE8816E7";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ZeppErrorCode {
    TokenExpired,
    RateLimited,
    NetworkError,
    RemoteError,
    ProtocolError,
}

#[derive(Debug, Clone)]
pub struct SetStepResult {
    pub success: bool,
    pub error: Option<String>,
    pub error_code: Option<ZeppErrorCode>,
    pub retryable: bool,
}

pub fn build_set_steps_request(
    device_id: &str,
    xiaomi_user_id: &str,
    steps: i64,
    now: DateTime<Utc>,
    request_id: &str,
) -> (String, String) {
    let timestamp = now.timestamp_millis();
    let today = now.with_timezone(&Shanghai).format("%Y-%m-%d").to_string();
    let encoded_steps = format!("%5C%22ttl%5C%22%3A{steps}");
    let data_json = DATA_JSON_TEMPLATE
        .trim_end()
        .replace("2021-08-07", &today)
        .replace("%5C%22ttl%5C%22%3A18272", &encoded_steps);
    let last_sync_time = now.timestamp() - 120;
    let device_id = if device_id.is_empty() {
        DEFAULT_DEVICE_ID
    } else {
        device_id
    };

    (
        format!(
            "https://api-mifit-cn.huami.com/v1/data/band_data.json?&t={timestamp}&r={request_id}"
        ),
        format!(
            "userid={xiaomi_user_id}&last_sync_data_time={last_sync_time}&device_type=0&last_deviceid={device_id}&data_json={data_json}"
        ),
    )
}

pub async fn set_steps(
    client: &reqwest::Client,
    token: &str,
    device_id: &str,
    xiaomi_user_id: &str,
    steps: i64,
) -> SetStepResult {
    let now = Utc::now();
    let request_id = uuid::Uuid::new_v4().to_string();
    let (url, body) = build_set_steps_request(device_id, xiaomi_user_id, steps, now, &request_id);
    let response = match tokio::time::timeout(
        Duration::from_secs(30),
        client
            .post(url)
            .header("apptoken", token)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send(),
    )
    .await
    {
        Ok(Ok(response)) => response,
        Ok(Err(error)) => {
            return SetStepResult {
                success: false,
                error: Some(error.to_string()),
                error_code: Some(ZeppErrorCode::NetworkError),
                retryable: true,
            };
        }
        Err(_) => {
            return SetStepResult {
                success: false,
                error: Some("Zepp 请求超时".to_owned()),
                error_code: Some(ZeppErrorCode::NetworkError),
                retryable: true,
            };
        }
    };

    if response.status().as_u16() != 200 {
        let status = response.status().as_u16();
        let response_text = response.text().await.unwrap_or_default();
        return classify_http_failure(status, &response_text);
    }

    let response_data = match response.json::<Value>().await {
        Ok(value) => value,
        Err(_) => {
            return SetStepResult {
                success: false,
                error: Some("Zepp 返回了无法解析的响应".to_owned()),
                error_code: Some(ZeppErrorCode::ProtocolError),
                retryable: false,
            };
        }
    };
    let message = response_data
        .get("message")
        .and_then(Value::as_str)
        .map(str::to_owned);
    if message.as_deref() == Some("success") {
        return SetStepResult {
            success: true,
            error: None,
            error_code: None,
            retryable: false,
        };
    }

    classify_vendor_failure(message.as_deref(), &response_data)
}

fn classify_http_failure(status: u16, response_text: &str) -> SetStepResult {
    let excerpt = response_text.chars().take(200).collect::<String>();
    if status == 401 || status == 403 {
        return SetStepResult {
            success: false,
            error: Some(format!("Zepp 登录凭证已失效 ({status})")),
            error_code: Some(ZeppErrorCode::TokenExpired),
            retryable: false,
        };
    }
    if status == 429 {
        return SetStepResult {
            success: false,
            error: Some("Zepp 请求过于频繁".to_owned()),
            error_code: Some(ZeppErrorCode::RateLimited),
            retryable: true,
        };
    }

    SetStepResult {
        success: false,
        error: Some(if excerpt.is_empty() {
            format!("Zepp 请求异常: {status}")
        } else {
            format!("Zepp 请求异常: {status} {excerpt}")
        }),
        error_code: Some(if status >= 500 {
            ZeppErrorCode::RemoteError
        } else {
            ZeppErrorCode::ProtocolError
        }),
        retryable: status >= 500,
    }
}

fn classify_vendor_failure(message: Option<&str>, response_data: &Value) -> SetStepResult {
    let normalized = message.unwrap_or_default().to_ascii_lowercase();
    let token_expired =
        normalized.contains("token") || normalized.contains("auth") || normalized.contains("0104");
    let fallback = serde_json::to_string(response_data).unwrap_or_default();
    let detail = message
        .map(str::to_owned)
        .unwrap_or_else(|| fallback.chars().take(200).collect());

    SetStepResult {
        success: false,
        error: Some(format!("设置步数失败: {detail}")),
        error_code: Some(if token_expired {
            ZeppErrorCode::TokenExpired
        } else {
            ZeppErrorCode::RemoteError
        }),
        retryable: !token_expired,
    }
}

#[cfg(test)]
mod tests;
