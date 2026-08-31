use std::{
    net::{IpAddr, SocketAddr},
    path::PathBuf,
    str::FromStr,
};

use anyhow::{Context, bail};

#[derive(Clone, Debug)]
pub struct Config {
    pub web_bind_address: SocketAddr,
    pub database_path: PathBuf,
    pub jwt_secret: String,
    pub encryption_key: String,
    pub admin_username: String,
    pub admin_password: String,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let host = env_or("MIMOTION_HOST", "127.0.0.1");
        let port = env_or("PORT", "3000")
            .parse::<u16>()
            .context("PORT 必须是有效端口")?;
        let ip = IpAddr::from_str(&host)
            .with_context(|| format!("MIMOTION_HOST 必须是有效 IP 地址，当前值为 {host}"))?;

        let database_path = PathBuf::from(env_or("DATABASE_URL", "./data/mimotion.db"));
        if let Some(parent) = database_path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("创建数据库目录 {} 失败", parent.display()))?;
        }

        let jwt_secret = required("JWT_SECRET")?;
        if jwt_secret.len() < 32 {
            bail!("JWT_SECRET 至少需要 32 字节");
        }

        let encryption_key = required("ENCRYPTION_KEY")?;
        if !is_hex_64(&encryption_key) {
            bail!("ENCRYPTION_KEY 必须是 64 位十六进制字符串");
        }

        Ok(Self {
            web_bind_address: SocketAddr::new(ip, port),
            database_path,
            jwt_secret,
            encryption_key,
            admin_username: env_or("ADMIN_USERNAME", "admin"),
            admin_password: env_or("ADMIN_PASSWORD", "password"),
        })
    }
}

fn env_or(name: &str, fallback: &str) -> String {
    std::env::var(name).unwrap_or_else(|_| fallback.to_owned())
}

fn required(name: &str) -> anyhow::Result<String> {
    std::env::var(name).with_context(|| format!("{name} 环境变量未设置"))
}

fn is_hex_64(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

#[cfg(test)]
mod tests {
    use super::is_hex_64;

    #[test]
    fn accepts_only_32_byte_hex_keys() {
        assert!(is_hex_64(&"a".repeat(64)));
        assert!(!is_hex_64(&"a".repeat(63)));
        assert!(!is_hex_64(&format!("{}z", "a".repeat(63))));
    }
}
