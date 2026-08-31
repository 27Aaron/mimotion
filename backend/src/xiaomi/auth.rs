use aes::Aes128;
use cbc::Encryptor;
use cipher::{BlockEncryptMut, KeyIvInit, block_padding::Pkcs7};
use reqwest::header::{CONTENT_TYPE, LOCATION};
use serde_json::Value;
use url::Url;

const HM_AES_KEY: &[u8; 16] = b"xeNtBVqzDc6tuNTh";
const HM_AES_IV: &[u8; 16] = b"MAAAYAAAAAAAAABg";

#[derive(Debug, Clone)]
pub struct LoginResult {
    pub success: bool,
    pub app_token: Option<String>,
    pub login_token: Option<String>,
    pub user_id: Option<String>,
    pub device_id: Option<String>,
    pub error: Option<String>,
}

pub async fn login_account(client: &reqwest::Client, account: &str, password: &str) -> LoginResult {
    let (user, is_phone) = normalize_user(account);
    let device_id = uuid::Uuid::new_v4().simple().to_string();
    let Some(access_token) = login_access_token(client, &user, password).await else {
        return LoginResult {
            success: false,
            app_token: None,
            login_token: None,
            user_id: None,
            device_id: None,
            error: Some("登录获取 accessToken 失败".to_owned()),
        };
    };

    match grant_login_tokens(client, &access_token, &device_id, is_phone).await {
        Ok((login_token, app_token, user_id)) => LoginResult {
            success: app_token.is_some(),
            app_token,
            login_token,
            user_id,
            device_id: Some(device_id),
            error: None,
        },
        Err(error) => LoginResult {
            success: false,
            app_token: None,
            login_token: None,
            user_id: None,
            device_id: None,
            error: Some(error),
        },
    }
}

pub async fn refresh_app_token(
    client: &reqwest::Client,
    login_token: &str,
    device_id: &str,
) -> Result<(String, Option<String>), String> {
    let data = [
        ("app_name", "com.xiaomi.hm.health"),
        ("app_version", "6.14.0"),
        ("code", login_token),
        ("country_code", "CN"),
        ("device_id", device_id),
        ("device_model", "phone"),
        ("grant_type", "access_token"),
        ("third_name", "huami_phone"),
    ];
    let response = post_form(client, "https://account.huami.com/v2/client/login", &data).await?;
    let status = response.status();
    let payload = response
        .json::<Value>()
        .await
        .map_err(|error| format!("刷新 token 响应解析失败: {error}"))?;
    if !status.is_success() {
        return Err(format!("刷新 token 失败({status})"));
    }
    if payload.get("result").and_then(Value::as_str) != Some("ok") {
        return Err(format!(
            "刷新 token 失败: {}",
            payload
                .get("result")
                .and_then(Value::as_str)
                .unwrap_or("unknown")
        ));
    }
    token_info(&payload)
        .map(|(login, app, _)| {
            app.map(|app| (app, login))
                .ok_or_else(|| "刷新 token 失败: 无 app_token".to_owned())
        })
        .unwrap_or_else(|| Err("刷新 token 失败: 无 token_info".to_owned()))
}

async fn login_access_token(
    client: &reqwest::Client,
    user: &str,
    password: &str,
) -> Option<String> {
    let data = [
        ("emailOrPhone", user),
        ("password", password),
        ("state", "REDIRECTION"),
        ("client_id", "HuaMi"),
        ("country_code", "CN"),
        ("token", "access"),
        (
            "redirect_uri",
            "https://s3-us-west-2.amazonaws.com/hm-registration/successsignin.html",
        ),
    ];
    let plaintext = form_urlencoded(&data);
    let mut buffer = vec![0_u8; plaintext.len() + 16];
    buffer[..plaintext.len()].copy_from_slice(plaintext.as_bytes());
    let encrypted = Encryptor::<Aes128>::new_from_slices(HM_AES_KEY, HM_AES_IV)
        .expect("fixed AES key and IV are valid")
        .encrypt_padded_mut::<Pkcs7>(&mut buffer, plaintext.len())
        .ok()?
        .to_vec();

    let response = client
        .post("https://api-user.zepp.com/v2/registrations/tokens")
        .header(
            CONTENT_TYPE,
            "application/x-www-form-urlencoded; charset=UTF-8",
        )
        .header(
            "user-agent",
            "MiFit6.14.0 (M2007J1SC; Android 12; Density/2.75)",
        )
        .header("app_name", "com.xiaomi.hm.health")
        .header("appname", "com.xiaomi.hm.health")
        .header("appplatform", "android_phone")
        .header("x-hm-ekv", "1")
        .header("hm-privacy-ceip", "false")
        .body(encrypted)
        .send()
        .await
        .ok()?;
    if response.status().as_u16() != 303 {
        return None;
    }
    let location = response.headers().get(LOCATION)?.to_str().ok()?;
    let url = Url::parse(location).ok()?;
    let mut access = None;
    let mut error = None;
    for (key, value) in url.query_pairs() {
        match key.as_ref() {
            "access" => access = Some(value.into_owned()),
            "error" => error = Some(value.into_owned()),
            _ => {}
        }
    }
    if error.is_some() {
        return None;
    }
    access
}

async fn grant_login_tokens(
    client: &reqwest::Client,
    access_token: &str,
    device_id: &str,
    is_phone: bool,
) -> Result<(Option<String>, Option<String>, Option<String>), String> {
    let mut data = if is_phone {
        Vec::new()
    } else {
        vec![
            ("allow_registration=", "false".to_owned()),
            ("app_name", "com.xiaomi.hm.health".to_owned()),
            ("app_version", "6.14.0".to_owned()),
            ("code", access_token.to_owned()),
            ("country_code", "CN".to_owned()),
            ("device_id", device_id.to_owned()),
            ("device_model", "android_phone".to_owned()),
            ("dn", "account.zepp.com,api-user.zepp.com,api-mifit.zepp.com,api-watch.zepp.com,app-analytics.zepp.com,api-analytics.huami.com,auth.zepp.com".to_owned()),
            ("grant_type", "access_token".to_owned()),
            ("lang", "zh_CN".to_owned()),
            ("os_version", "1.5.0".to_owned()),
            ("source", "com.xiaomi.hm.health:6.14.0:50818".to_owned()),
            ("third_name", "email".to_owned()),
        ]
    };
    if is_phone {
        data.extend([
            ("app_name", "com.xiaomi.hm.health".to_owned()),
            ("app_version", "6.14.0".to_owned()),
            ("code", access_token.to_owned()),
            ("country_code", "CN".to_owned()),
            ("device_id", device_id.to_owned()),
            ("device_model", "phone".to_owned()),
            ("grant_type", "access_token".to_owned()),
            ("third_name", "huami_phone".to_owned()),
        ]);
    }
    let response =
        post_form_owned(client, "https://account.huami.com/v2/client/login", &data).await?;
    let payload = response
        .json::<Value>()
        .await
        .map_err(|error| format!("客户端登录响应解析失败: {error}"))?;
    if payload.get("result").and_then(Value::as_str) != Some("ok") {
        return Err(format!(
            "客户端登录失败: {}",
            payload
                .get("result")
                .and_then(Value::as_str)
                .unwrap_or("unknown")
        ));
    }
    token_info(&payload).ok_or_else(|| "无 token_info".to_owned())
}

fn token_info(payload: &Value) -> Option<(Option<String>, Option<String>, Option<String>)> {
    let info = payload.get("token_info")?;
    Some((
        info.get("login_token")
            .and_then(Value::as_str)
            .map(str::to_owned),
        info.get("app_token")
            .and_then(Value::as_str)
            .map(str::to_owned),
        info.get("user_id")
            .and_then(Value::as_str)
            .map(str::to_owned),
    ))
}

async fn post_form(
    client: &reqwest::Client,
    url: &str,
    data: &[(&str, &str)],
) -> Result<reqwest::Response, String> {
    login_request(client, url)
        .body(form_urlencoded(data))
        .send()
        .await
        .map_err(|error| format!("网络错误: {error}"))
}

async fn post_form_owned(
    client: &reqwest::Client,
    url: &str,
    data: &[(impl AsRef<str>, String)],
) -> Result<reqwest::Response, String> {
    let body = data
        .iter()
        .map(|(key, value)| (key.as_ref().to_owned(), value.clone()))
        .collect::<Vec<_>>();
    login_request(client, url)
        .body(
            body.iter()
                .map(|(key, value)| (key.as_str(), value.as_str()))
                .collect::<Vec<_>>()
                .as_slice()
                .iter()
                .fold(String::new(), |mut result, (key, value)| {
                    let encoded = form_urlencoded(&[(key, value)]);
                    if !result.is_empty() {
                        result.push('&');
                    }
                    result.push_str(&encoded);
                    result
                }),
        )
        .send()
        .await
        .map_err(|error| format!("网络错误: {error}"))
}

fn login_request(client: &reqwest::Client, url: &str) -> reqwest::RequestBuilder {
    client
        .post(url)
        .header("app_name", "com.xiaomi.hm.health")
        .header("x-request-id", uuid::Uuid::new_v4().to_string())
        .header("accept-language", "zh-CN")
        .header("appname", "com.xiaomi.hm.health")
        .header("cv", "50818_6.14.0")
        .header("v", "2.0")
        .header("appplatform", "android_phone")
        .header(
            CONTENT_TYPE,
            "application/x-www-form-urlencoded; charset=UTF-8",
        )
}

fn form_urlencoded(data: &[(&str, &str)]) -> String {
    let mut serializer = url::form_urlencoded::Serializer::new(String::new());
    for (key, value) in data {
        serializer.append_pair(key, value);
    }
    serializer.finish()
}

fn normalize_user(value: &str) -> (String, bool) {
    let user = if value.starts_with("+86") || value.contains('@') {
        value.to_owned()
    } else {
        format!("+86{value}")
    };
    let is_phone = user.starts_with("+86");
    (user, is_phone)
}
