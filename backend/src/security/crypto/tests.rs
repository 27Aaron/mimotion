use super::{decrypt, encrypt, key_id};
use crate::config::Config;

fn config() -> Config {
    Config {
        web_bind_address: "127.0.0.1:3000".parse().unwrap(),
        database_path: "data/test.db".into(),
        jwt_secret: "a".repeat(32),
        encryption_key: "b".repeat(64),
        admin_username: "admin".into(),
        admin_password: "password".into(),
    }
}

#[test]
fn round_trip_uses_the_legacy_compatible_shape() {
    let config = config();
    let (encrypted, iv) = encrypt(&config, "秘密凭据").unwrap();
    assert!(encrypted.starts_with(&format!("v1:{}:", key_id(&config))));
    assert_eq!(decrypt(&config, &encrypted, &iv).unwrap(), "秘密凭据");
}
