use super::{create_token, verify_token};
use crate::{config::Config, storage::models::UserRow};

#[test]
fn hs256_session_token_round_trips_with_configured_provider() {
    let config = Config {
        web_bind_address: "127.0.0.1:3000".parse().unwrap(),
        database_path: "data/test.db".into(),
        jwt_secret: "test-secret-with-at-least-32-bytes".into(),
        encryption_key: "b".repeat(64),
        admin_username: "admin".into(),
        admin_password: "password".into(),
    };
    let user = UserRow {
        id: "test-user".into(),
        username: "test".into(),
        password_hash: "unused".into(),
        is_admin: Some(1),
        locale: Some("zh".into()),
        bark_url: None,
        bark_url_data: None,
        bark_url_iv: None,
        telegram_bot_token: None,
        telegram_bot_token_data: None,
        telegram_bot_token_iv: None,
        telegram_chat_id: None,
    };

    let token = create_token(&config, &user).unwrap();
    let claims = verify_token(&config, &token).unwrap();
    assert_eq!(claims.user_id, user.id);
    assert_eq!(claims.username, user.username);
    assert!(claims.is_admin);
    assert!(
        verify_token(
            &Config {
                jwt_secret: "a-different-secret-with-at-least-32-bytes".into(),
                ..config
            },
            &token
        )
        .is_none()
    );
}
