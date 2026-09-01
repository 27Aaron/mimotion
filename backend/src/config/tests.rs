use super::is_hex_64;

#[test]
fn accepts_only_32_byte_hex_keys() {
    assert!(is_hex_64(&"a".repeat(64)));
    assert!(!is_hex_64(&"a".repeat(63)));
    assert!(!is_hex_64(&format!("{}z", "a".repeat(63))));
}
