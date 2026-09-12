use keyring::Entry;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub id: String, // e.g. "openai", "anthropic", "ollama", "openrouter"
    pub is_cloud: bool,
    pub base_url: String,
    pub model: String,
}

pub struct AiState {
    pub enabled: AtomicBool,
    pub active_provider: RwLock<Option<ProviderConfig>>,
    pub cloud_consent_id: RwLock<Option<String>>,
}

impl Default for AiState {
    fn default() -> Self {
        Self {
            enabled: AtomicBool::new(false),
            active_provider: RwLock::new(None),
            cloud_consent_id: RwLock::new(None),
        }
    }
}

impl AiState {
    pub fn get_api_key(&self, provider_id: &str) -> Option<String> {
        let entry = Entry::new("velco-ai-secrets", provider_id).ok()?;
        entry.get_password().ok()
    }

    pub fn set_api_key(&self, provider_id: &str, secret: &str) -> Result<(), String> {
        let entry = Entry::new("velco-ai-secrets", provider_id)
            .map_err(|e| format!("Keyring error: {}", e))?;
        entry.set_password(secret)
            .map_err(|e| format!("Keyring set error: {}", e))
    }

    pub fn clear_api_key(&self, provider_id: &str) -> Result<(), String> {
        let entry = Entry::new("velco-ai-secrets", provider_id)
            .map_err(|e| format!("Keyring error: {}", e))?;
        let _ = entry.delete_credential(); // ignore if doesn't exist
        Ok(())
    }

    pub fn resolve_provider(&self, consent_id: Option<&str>) -> Result<(ProviderConfig, Option<String>), String> {
        if !self.enabled.load(Ordering::Relaxed) {
            return Err("AI features are disabled by privacy settings.".to_string());
        }

        let provider = self.active_provider.read().clone().ok_or_else(|| "No active AI provider configured or provider is 'none'.".to_string())?;

        if provider.id == "none" {
            return Err("AI provider is set to 'none'.".to_string());
        }

        if provider.is_cloud {
            let current_consent = self.cloud_consent_id.read().clone();
            if current_consent.is_none() || current_consent.as_deref() != consent_id {
                return Err("Valid cloud consent permit is required for cloud providers.".to_string());
            }
        }

        let api_key = if provider.is_cloud {
            Some(self.get_api_key(&provider.id).ok_or_else(|| format!("API key not found for provider {}", provider.id))?)
        } else {
            None
        };

        Ok((provider, api_key))
    }
}
