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
