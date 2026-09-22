use chinese_holiday::{Ymd, chinese_holiday};
use chrono::{DateTime, Datelike, Duration, NaiveDate, Timelike, Utc};
use chrono_tz::Asia::Shanghai;

const FIELD_RANGES: [(u32, u32); 5] = [(0, 59), (0, 23), (1, 31), (1, 12), (0, 7)];
pub const WEEKLY_CALENDAR_MODE: &str = "weekly";
pub const CHINA_WORKDAY_CALENDAR_MODE: &str = "china_workday";

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

pub fn normalize_for_calendar_mode(expression: &str, calendar_mode: &str) -> Option<String> {
    if !is_valid_calendar_mode(calendar_mode) {
        return None;
    }
    let normalized = normalize(expression)?;
    if calendar_mode != CHINA_WORKDAY_CALENDAR_MODE {
        return Some(normalized);
    }

    let mut fields = normalized
        .split_whitespace()
        .map(str::to_owned)
        .collect::<Vec<_>>();
    fields[4] = "*".to_owned();
    Some(fields.join(" "))
}

pub fn is_valid_calendar_mode(calendar_mode: &str) -> bool {
    matches!(
        calendar_mode,
        WEEKLY_CALENDAR_MODE | CHINA_WORKDAY_CALENDAR_MODE
    )
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

pub fn matches_schedule(expression: &str, calendar_mode: &str, timestamp_ms: i64) -> bool {
    if !matches(expression, timestamp_ms) {
        return false;
    }
    match calendar_mode {
        WEEKLY_CALENDAR_MODE => true,
        CHINA_WORKDAY_CALENDAR_MODE => is_china_workday(timestamp_ms),
        _ => false,
    }
}

pub fn next_occurrence(expression: &str, after_ms: i64) -> Option<i64> {
    next_occurrence_for_calendar_mode(expression, WEEKLY_CALENDAR_MODE, after_ms)
}

pub fn next_occurrence_for_calendar_mode(
    expression: &str,
    calendar_mode: &str,
    after_ms: i64,
) -> Option<i64> {
    let mut candidate = DateTime::<Utc>::from_timestamp_millis(after_ms)?
        .checked_add_signed(Duration::minutes(1))?
        .with_second(0)?
        .with_nanosecond(0)?;

    for _ in 0..(366 * 24 * 60) {
        if matches_schedule(expression, calendar_mode, candidate.timestamp_millis()) {
            return Some(candidate.timestamp_millis());
        }
        candidate = candidate.checked_add_signed(Duration::minutes(1))?;
    }
    None
}

fn is_china_workday(timestamp_ms: i64) -> bool {
    let Some(date) = DateTime::<Utc>::from_timestamp_millis(timestamp_ms) else {
        return false;
    };
    let local = date.with_timezone(&Shanghai);
    let local_date = local.date_naive();
    let supported_start = NaiveDate::from_ymd_opt(2004, 1, 1).expect("valid date");
    // chinese_holiday 2026.0.1 embeds official adjustment data through 2026-12-25.
    // Keep a weekday fallback outside that range until the annual crate data is updated.
    let supported_end = NaiveDate::from_ymd_opt(2026, 12, 25).expect("valid date");
    if local_date < supported_start || local_date > supported_end {
        return local.weekday().number_from_monday() <= 5;
    }
    let ymd = Ymd::new(
        local_date.year() as u16,
        local_date.month() as u8,
        local_date.day() as u8,
    );
    chinese_holiday(ymd).is_workday()
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

    use super::{
        CHINA_WORKDAY_CALENDAR_MODE, matches, matches_schedule, next_occurrence,
        next_occurrence_for_calendar_mode, normalize, normalize_for_calendar_mode,
    };

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

    #[test]
    fn normalizes_china_workday_schedules_to_all_weekdays() {
        assert_eq!(
            normalize_for_calendar_mode("0 9 * * 1-5", CHINA_WORKDAY_CALENDAR_MODE),
            Some("0 9 * * *".to_owned())
        );
    }

    #[test]
    fn includes_makeup_workdays_and_skips_holidays() {
        let makeup_sunday = Utc.with_ymd_and_hms(2026, 1, 4, 1, 0, 0).unwrap();
        let new_year_holiday = Utc.with_ymd_and_hms(2026, 1, 1, 1, 0, 0).unwrap();
        assert!(matches_schedule(
            "0 9 * * *",
            CHINA_WORKDAY_CALENDAR_MODE,
            makeup_sunday.timestamp_millis()
        ));
        assert!(!matches_schedule(
            "0 9 * * *",
            CHINA_WORKDAY_CALENDAR_MODE,
            new_year_holiday.timestamp_millis()
        ));
    }

    #[test]
    fn finds_the_next_china_workday() {
        let start = Utc.with_ymd_and_hms(2026, 1, 1, 1, 0, 30).unwrap();
        let next = next_occurrence_for_calendar_mode(
            "0 9 * * *",
            CHINA_WORKDAY_CALENDAR_MODE,
            start.timestamp_millis(),
        )
        .unwrap();
        assert_eq!(
            DateTime::<Utc>::from_timestamp_millis(next)
                .unwrap()
                .to_rfc3339(),
            "2026-01-04T01:00:00+00:00"
        );
    }
}
