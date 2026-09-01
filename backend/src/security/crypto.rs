use aes_gcm::{
    Aes256Gcm, Nonce,
    aead::{Aead, KeyInit},
};
use anyhow::{Context, bail};
use sha2::{Digest, Sha256};

use crate::config::Config;

const FORMAT_VERSION: &str = "v1";

pub fn encrypt(config: &Config, plaintext: &str) -> anyhow::Result<(String, String)> {
    let key = configured_key(config)?;
    let iv: [u8; 12] = rand::random();
    let iv = iv.to_vec();
    let cipher = Aes256Gcm::new_from_slice(&key).expect("AES-256-GCM accepts a 32-byte key");
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&iv), plaintext.as_bytes())
        .map_err(|_| anyhow::anyhow!("加密失败"))?;

    Ok((
        format!(
            "{FORMAT_VERSION}:{}:{}",
            key_id(config),
            hex::encode(ciphertext),
        ),
        hex::encode(iv),
    ))
}

pub fn decrypt(config: &Config, encrypted: &str, iv_hex: &str) -> anyhow::Result<String> {
    let key = configured_key(config)?;
    let (payload, expected_key_id) = if let Some((version, rest)) = encrypted.split_once(':') {
        if version != FORMAT_VERSION {
            bail!("不支持的加密数据版本");
        }
        let (key_id, payload) = rest.split_once(':').context("加密数据格式无效")?;
        (payload, Some(key_id))
    } else {
        (encrypted, None)
    };

    if expected_key_id.is_some_and(|value| value != key_id(config)) {
        bail!("当前 ENCRYPTION_KEY 与凭据不匹配");
    }

    let iv = hex::decode(iv_hex).context("加密 IV 格式无效")?;
    if iv.len() != 12 {
        bail!("加密 IV 长度无效");
    }
    let ciphertext = hex::decode(payload).context("加密数据格式无效")?;
    let cipher = Aes256Gcm::new_from_slice(&key).expect("AES-256-GCM accepts a 32-byte key");
    let plaintext = cipher
        .decrypt(Nonce::from_slice(&iv), ciphertext.as_ref())
        .map_err(|_| anyhow::anyhow!("解密失败"))?;

    String::from_utf8(plaintext).context("解密后的数据不是 UTF-8")
}

pub fn key_id(config: &Config) -> String {
    let normalized = config.encryption_key.to_ascii_lowercase();
    hex::encode(Sha256::digest(normalized.as_bytes()))[..12].to_owned()
}

fn configured_key(config: &Config) -> anyhow::Result<Vec<u8>> {
    let key = hex::decode(&config.encryption_key).context("ENCRYPTION_KEY 不是有效十六进制")?;
    if key.len() != 32 {
        bail!("ENCRYPTION_KEY 必须解码为 32 字节");
    }
    Ok(key)
}

#[cfg(test)]
mod tests;
