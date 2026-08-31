use crate::{
    config::Config,
    crypto,
    xiaomi::{
        LoginResult, SetStepResult, ZeppErrorCode, login_account, refresh_app_token, set_steps,
    },
};

#[derive(Debug, Clone)]
pub struct StoredXiaomiCredentials {
    pub account: Option<String>,
    pub xiaomi_user_id: Option<String>,
    pub device_id: Option<String>,
    pub token_data: String,
    pub token_iv: Option<String>,
    pub login_token_data: Option<String>,
    pub login_token_iv: Option<String>,
    pub password_data: Option<String>,
    pub password_iv: Option<String>,
}

#[derive(Debug, Clone)]
pub struct CredentialUpdate {
    pub token_data: String,
    pub token_iv: String,
    pub login_token_data: Option<String>,
    pub login_token_iv: Option<String>,
    pub password_data: Option<String>,
    pub password_iv: Option<String>,
    pub device_id: Option<String>,
    pub xiaomi_user_id: Option<String>,
}

#[derive(Debug, Clone)]
pub struct AccountSyncResult {
    pub set_step: SetStepResult,
    pub credential_update: Option<CredentialUpdate>,
    pub token_expired: bool,
}

pub async fn sync_account(
    config: &Config,
    client: &reqwest::Client,
    credentials: &StoredXiaomiCredentials,
    steps: i64,
) -> AccountSyncResult {
    let app_token = match crypto::decrypt(
        config,
        &credentials.token_data,
        credentials.token_iv.as_deref().unwrap_or_default(),
    ) {
        Ok(token) => token,
        Err(error) => {
            return AccountSyncResult {
                set_step: failed_result(
                    format!("小米凭据解密失败: {error}"),
                    ZeppErrorCode::ProtocolError,
                    false,
                ),
                credential_update: None,
                token_expired: false,
            };
        }
    };

    let mut result = set_steps(
        client,
        &app_token,
        credentials.device_id.as_deref().unwrap_or_default(),
        credentials.xiaomi_user_id.as_deref().unwrap_or_default(),
        steps,
    )
    .await;
    if result.success || result.error_code != Some(ZeppErrorCode::TokenExpired) {
        return AccountSyncResult {
            set_step: result,
            credential_update: None,
            token_expired: false,
        };
    }

    if let (Some(data), Some(iv)) = (
        credentials.login_token_data.as_deref(),
        credentials.login_token_iv.as_deref(),
    ) && let Ok(login_token) = crypto::decrypt(config, data, iv)
        && let Ok((new_app_token, new_login_token)) = refresh_app_token(
            client,
            &login_token,
            credentials.device_id.as_deref().unwrap_or_default(),
        )
        .await
    {
        let credential_update = encrypt_credential_update(
            config,
            &new_app_token,
            new_login_token.as_deref(),
            None,
            None,
            credentials.device_id.clone(),
            credentials.xiaomi_user_id.clone(),
        );
        result = set_steps(
            client,
            &new_app_token,
            credentials.device_id.as_deref().unwrap_or_default(),
            credentials.xiaomi_user_id.as_deref().unwrap_or_default(),
            steps,
        )
        .await;
        let token_expired = result.error_code == Some(ZeppErrorCode::TokenExpired);
        return AccountSyncResult {
            set_step: result,
            credential_update: Some(credential_update),
            token_expired,
        };
    }

    if let (Some(account), Some(data), Some(iv)) = (
        credentials.account.as_deref(),
        credentials.password_data.as_deref(),
        credentials.password_iv.as_deref(),
    ) && let Ok(password) = crypto::decrypt(config, data, iv)
    {
        let relogin = login_account(client, account, &password).await;
        if relogin.success
            && let Some(new_app_token) = relogin.app_token.as_deref()
        {
            let credential_update = encrypt_credential_update(
                config,
                new_app_token,
                relogin.login_token.as_deref(),
                Some(password.as_str()),
                relogin.device_id.clone(),
                relogin.device_id.clone(),
                relogin.user_id.clone(),
            );
            result = set_steps(
                client,
                new_app_token,
                relogin
                    .device_id
                    .as_deref()
                    .or(credentials.device_id.as_deref())
                    .unwrap_or_default(),
                relogin
                    .user_id
                    .as_deref()
                    .or(credentials.xiaomi_user_id.as_deref())
                    .unwrap_or_default(),
                steps,
            )
            .await;
            let token_expired = result.error_code == Some(ZeppErrorCode::TokenExpired);
            return AccountSyncResult {
                set_step: result,
                credential_update: Some(credential_update),
                token_expired,
            };
        }
        return AccountSyncResult {
            set_step: failed_result(
                relogin
                    .error
                    .unwrap_or_else(|| "小米账号重新登录失败".to_owned()),
                ZeppErrorCode::TokenExpired,
                false,
            ),
            credential_update: None,
            token_expired: true,
        };
    }

    result.error = Some(
        result
            .error
            .unwrap_or_else(|| "登录凭证已过期，请重新绑定账号".to_owned()),
    );
    result.retryable = false;
    AccountSyncResult {
        set_step: result,
        credential_update: None,
        token_expired: true,
    }
}

fn encrypt_credential_update(
    config: &Config,
    app_token: &str,
    login_token: Option<&str>,
    password: Option<&str>,
    device_id: Option<String>,
    fallback_device_id: Option<String>,
    xiaomi_user_id: Option<String>,
) -> CredentialUpdate {
    let (token_data, token_iv) =
        crypto::encrypt(config, app_token).expect("configured encryption key must be valid");
    let (login_token_data, login_token_iv) = login_token
        .map(|token| {
            crypto::encrypt(config, token).expect("configured encryption key must be valid")
        })
        .map(|(data, iv)| (Some(data), Some(iv)))
        .unwrap_or((None, None));
    let (password_data, password_iv) = password
        .map(|value| {
            crypto::encrypt(config, value).expect("configured encryption key must be valid")
        })
        .map(|(data, iv)| (Some(data), Some(iv)))
        .unwrap_or((None, None));
    CredentialUpdate {
        token_data,
        token_iv,
        login_token_data,
        login_token_iv,
        password_data,
        password_iv,
        device_id: device_id.or(fallback_device_id),
        xiaomi_user_id,
    }
}

fn failed_result(error: String, error_code: ZeppErrorCode, retryable: bool) -> SetStepResult {
    SetStepResult {
        success: false,
        error: Some(error),
        error_code: Some(error_code),
        retryable,
        http_status: None,
        vendor_code: None,
    }
}

#[allow(dead_code)]
fn _login_device_id(result: &LoginResult) -> Option<&str> {
    result.device_id.as_deref()
}
