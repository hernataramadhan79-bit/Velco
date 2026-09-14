use parking_lot::Mutex;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::LazyLock;
use std::time::{Duration, Instant};

use crate::database::Database;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiUsageSummary {
    pub today_cost: f64,
    pub today_tokens_in: u64,
    pub today_tokens_out: u64,
    pub month_cost: f64,
    pub month_tokens_in: u64,
    pub month_tokens_out: u64,
    pub total_cost: f64,
}

pub fn estimate_tokens(text: &str) -> usize {
    if text.is_empty() {
        return 0;
    }
    text.len().div_ceil(4)
}

pub fn calculate_estimated_cost(provider: &str, model: &str, token_in: usize, token_out: usize) -> f64 {
    let p_lower = provider.to_lowercase();
    let m_lower = model.to_lowercase();

    // Local inference is completely free
    if p_lower == "ollama" || p_lower == "lmstudio" || p_lower == "local" {
        return 0.0;
    }

    // Pricing per 1 Million tokens (input, output) in USD
    let (cost_per_m_in, cost_per_m_out): (f64, f64) = if p_lower == "openai" {
        if m_lower.contains("gpt-4o-mini") {
            (0.15, 0.60)
        } else if m_lower.contains("gpt-4o") {
            (2.50, 10.00)
        } else {
            (1.00, 3.00)
        }
    } else if p_lower == "anthropic" {
        if m_lower.contains("haiku") {
            (0.80, 4.00)
        } else if m_lower.contains("sonnet") {
            (3.00, 15.00)
        } else if m_lower.contains("opus") {
            (15.00, 75.00)
        } else {
            (3.00, 15.00)
        }
    } else if p_lower == "gemini" {
        if m_lower.contains("pro") {
            (1.25, 5.00)
        } else {
            (0.075, 0.30)
        }
    } else if p_lower == "deepseek" {
        (0.14, 0.28)
    } else {
        // OpenRouter / Groq / custom default fallback
        (0.50, 1.50)
    };

    let in_cost = (token_in as f64 / 1_000_000.0) * cost_per_m_in;
    let out_cost = (token_out as f64 / 1_000_000.0) * cost_per_m_out;
    in_cost + out_cost
}

pub fn record_ai_usage(
    db: &Database,
    provider: &str,
    model: &str,
    token_in: usize,
    token_out: usize,
) -> Result<(), String> {
    let cost = calculate_estimated_cost(provider, model, token_in, token_out);
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let conn = db.write_conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        r#"
        INSERT INTO ai_usage_log (id, provider, model, token_in, token_out, estimated_cost, timestamp)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        "#,
        params![id, provider, model, token_in as i64, token_out as i64, cost, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn query_ai_usage_summary(db: &Database) -> Result<AiUsageSummary, String> {
    let conn = db.read_pool.get().map_err(|e| e.to_string())?;

    let today_prefix = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let month_prefix = chrono::Utc::now().format("%Y-%m").to_string();

    let (today_cost, today_in, today_out): (f64, i64, i64) = conn
        .query_row(
            r#"
            SELECT COALESCE(SUM(estimated_cost), 0.0), COALESCE(SUM(token_in), 0), COALESCE(SUM(token_out), 0)
            FROM ai_usage_log
            WHERE timestamp LIKE ?1 || '%'
            "#,
            params![today_prefix],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .unwrap_or((0.0, 0, 0));

    let (month_cost, month_in, month_out): (f64, i64, i64) = conn
        .query_row(
            r#"
            SELECT COALESCE(SUM(estimated_cost), 0.0), COALESCE(SUM(token_in), 0), COALESCE(SUM(token_out), 0)
            FROM ai_usage_log
            WHERE timestamp LIKE ?1 || '%'
            "#,
            params![month_prefix],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .unwrap_or((0.0, 0, 0));

    let total_cost: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(estimated_cost), 0.0) FROM ai_usage_log",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0.0);

    Ok(AiUsageSummary {
        today_cost,
        today_tokens_in: today_in.max(0) as u64,
        today_tokens_out: today_out.max(0) as u64,
        month_cost,
        month_tokens_in: month_in.max(0) as u64,
        month_tokens_out: month_out.max(0) as u64,
        total_cost,
    })
}

// ── Rate Limiting & Backoff Guard ─────────────────────────

static RATE_LIMITER: LazyLock<Mutex<RateLimiterState>> = LazyLock::new(|| {
    Mutex::new(RateLimiterState {
        last_call: HashMap::new(),
        backoff_until: HashMap::new(),
    })
});

struct RateLimiterState {
    last_call: HashMap<String, Instant>,
    backoff_until: HashMap<String, Instant>,
}

/// Enforces rate limit on cloud providers: minimum 1000ms between calls, plus backoff on 429.
pub fn check_rate_limit(provider: &str) -> Result<(), String> {
    let p_lower = provider.to_lowercase();
    // Do not rate limit local providers
    if p_lower == "ollama" || p_lower == "lmstudio" || p_lower == "local" {
        return Ok(());
    }

    let mut state = RATE_LIMITER.lock();
    let now = Instant::now();

    // Check if in backoff
    if let Some(&until) = state.backoff_until.get(&p_lower) {
        if now < until {
            let wait_secs = until.duration_since(now).as_secs() + 1;
            return Err(format!(
                "Rate limit active for {}. Please wait {}s before trying again.",
                provider, wait_secs
            ));
        } else {
            state.backoff_until.remove(&p_lower);
        }
    }

    // Minimum interval: 1000ms
    if let Some(&last) = state.last_call.get(&p_lower) {
        let elapsed = now.duration_since(last);
        if elapsed < Duration::from_millis(1000) {
            let wait_ms = 1000 - elapsed.as_millis();
            return Err(format!(
                "Rate limit: request too frequent for {}. Please wait {}ms.",
                provider, wait_ms
            ));
        }
    }

    state.last_call.insert(p_lower, now);
    Ok(())
}

/// Records a 429 rate limit response to trigger exponential/temporary backoff
pub fn record_429(provider: &str) {
    let p_lower = provider.to_lowercase();
    let mut state = RATE_LIMITER.lock();
    let backoff_duration = Duration::from_secs(10); // 10s cooldown
    state.backoff_until.insert(p_lower, Instant::now() + backoff_duration);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_estimate_tokens() {
        assert_eq!(estimate_tokens(""), 0);
        assert_eq!(estimate_tokens("Hello world"), 3);
        assert_eq!(estimate_tokens("12345678"), 2);
    }

    #[test]
    fn test_calculate_estimated_cost_local_is_free() {
        let cost = calculate_estimated_cost("ollama", "qwen2.5:latest", 5000, 1000);
        assert_eq!(cost, 0.0);

        let cost_lm = calculate_estimated_cost("lmstudio", "model", 10000, 5000);
        assert_eq!(cost_lm, 0.0);
    }

    #[test]
    fn test_calculate_estimated_cost_cloud() {
        let cost = calculate_estimated_cost("openai", "gpt-4o-mini", 1_000_000, 1_000_000);
        // $0.15 + $0.60 = $0.75
        assert!((cost - 0.75).abs() < 1e-6);
    }
}
