use chrono::{DateTime, Datelike, Duration, Timelike, Utc};
use chrono_tz::Asia::Shanghai;

const FIELD_RANGES: [(u32, u32); 5] = [(0, 59), (0, 23), (1, 31), (1, 12), (0, 7)];

pub fn normalize(expression: &str) -> Option<String> {
    let normalized = expression.split_whitespace().collect::<Vec<_>>().join(" ");
    let fields = normalized.split(' ').collect::<Vec<_>>();
    if fields.len() != 5
        || !fields
            .iter()
            .enumerate()
            .all(|(index, field)| valid_field(field, FIELD_RANGES[index]))
    {
        return None;
    }
    Some(normalized)
}

pub fn matches(expression: &str, timestamp_ms: i64) -> bool {
    let Some(date) = DateTime::<Utc>::from_timestamp_millis(timestamp_ms) else {
        return false;
    };
    let local = date.with_timezone(&Shanghai);
    let fields = expression.split_whitespace().collect::<Vec<_>>();
    if fields.len() != 5 {
        return false;
    }

    let values = [
        local.minute(),
        local.hour(),
        local.day(),
        local.month(),
        local.weekday().num_days_from_sunday(),
    ];
    fields
        .iter()
        .enumerate()
        .all(|(index, field)| matches_field(field, values[index]))
}

pub fn next_occurrence(expression: &str, after_ms: i64) -> Option<i64> {
    let mut candidate = DateTime::<Utc>::from_timestamp_millis(after_ms)?
        .checked_add_signed(Duration::minutes(1))?
        .with_second(0)?
        .with_nanosecond(0)?;

    for _ in 0..(366 * 24 * 60) {
        if matches(expression, candidate.timestamp_millis()) {
            return Some(candidate.timestamp_millis());
        }
        candidate = candidate.checked_add_signed(Duration::minutes(1))?;
    }
    None
}

fn valid_field(field: &str, (min, max): (u32, u32)) -> bool {
    if field.is_empty() {
        return false;
    }
    field.split(',').all(|part| {
        if part == "*" {
            return true;
        }
        if let Some(step) = part.strip_prefix("*/") {
            return step.parse::<u32>().is_ok_and(|value| value > 0);
        }
        if let Some((start, end)) = part.split_once('-') {
            return start
                .parse::<u32>()
                .ok()
                .zip(end.parse::<u32>().ok())
                .is_some_and(|(start, end)| start <= end && start >= min && end <= max);
        }
        part.parse::<u32>()
            .is_ok_and(|value| value >= min && value <= max)
    })
}

fn matches_field(field: &str, current: u32) -> bool {
    if field == "*" {
        return true;
    }
    field.split(',').any(|part| {
        if let Some(step) = part.strip_prefix("*/") {
            return step
                .parse::<u32>()
                .ok()
                .is_some_and(|step| step > 0 && current.is_multiple_of(step));
        }
        if let Some((start, end)) = part.split_once('-') {
            return start
                .parse::<u32>()
                .ok()
                .zip(end.parse::<u32>().ok())
                .is_some_and(|(start, end)| current >= start && current <= end);
        }
        part.parse::<u32>().is_ok_and(|value| value == current)
    })
}

pub fn timestamp_to_iso(timestamp_ms: Option<i64>) -> Option<String> {
    timestamp_ms
        .and_then(DateTime::<Utc>::from_timestamp_millis)
        .map(|date| date.to_rfc3339())
}

pub fn timestamp_to_iso_or_raw(timestamp_ms: i64) -> String {
    timestamp_to_iso(Some(timestamp_ms)).unwrap_or_else(|| timestamp_ms.to_string())
}

#[cfg(test)]
mod tests {
    use chrono::{DateTime, TimeZone, Utc};

    use super::{matches, next_occurrence, normalize};

    #[test]
    fn validates_the_five_field_ui_format() {
        assert_eq!(normalize(" 0 9 * * 1-5 "), Some("0 9 * * 1-5".to_owned()));
        assert!(normalize("0 9 * * 1-5/2").is_none());
        assert!(normalize("60 9 * * 1").is_none());
    }

    #[test]
    fn evaluates_in_shanghai_time() {
        let utc = Utc.with_ymd_and_hms(2026, 8, 31, 1, 0, 0).unwrap();
        assert!(matches("0 9 * * 1", utc.timestamp_millis()));
    }

    #[test]
    fn finds_the_next_minute() {
        let start = Utc.with_ymd_and_hms(2026, 8, 30, 0, 0, 30).unwrap();
        let next = next_occurrence("0 9 * * *", start.timestamp_millis()).unwrap();
        assert_eq!(
            DateTime::<Utc>::from_timestamp_millis(next)
                .unwrap()
                .to_rfc3339(),
            "2026-08-30T01:00:00+00:00"
        );
    }
}
