use chrono::{TimeZone, Utc};

use super::build_set_steps_request;

#[test]
fn builds_the_same_wire_shape_as_the_legacy_client() {
    let now = Utc.with_ymd_and_hms(2026, 8, 31, 1, 0, 0).unwrap();
    let (url, body) = build_set_steps_request("device", "user", 12345, now, "request-id");
    assert!(url.contains("t=1788138000000"));
    assert!(body.contains("userid=user"));
    assert!(body.contains("%5C%22ttl%5C%22%3A12345"));
    assert!(body.contains("%22date%22%3A%222026-08-31%22"));
}
