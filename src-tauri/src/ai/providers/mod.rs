pub mod anthropic;
pub mod gemini;
pub mod ollama;
pub mod openai_compatible;

use std::future::Future;
use std::pin::Pin;
use tokio_util::sync::CancellationToken;

use crate::ai::LlmProviderConfig;

#[derive(Debug, Clone)]
pub struct ExtractedImage {
    pub file_name: String,
    pub mime_type: String,
    pub base64: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct ChatMessagePayload {
    pub role: String,
    pub content: String,
}

pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

pub trait AiProvider: Send + Sync {
    fn id(&self) -> &str;
    fn is_cloud(&self) -> bool;
    fn model(&self) -> &str;

    fn completion<'a>(
        &'a self,
        client: &'a reqwest::Client,
        system_prompt: &'a str,
        user_prompt: &'a str,
        images: &'a [ExtractedImage],
    ) -> BoxFuture<'a, Result<String, String>>;

    #[allow(clippy::too_many_arguments)]
    fn stream_chat<'a>(
        &'a self,
        client: &'a reqwest::Client,
        system_prompt: &'a str,
        messages: &'a [ChatMessagePayload],
        images: &'a [ExtractedImage],
        app: &'a tauri::AppHandle,
        request_id: &'a str,
        cancel_token: &'a CancellationToken,
    ) -> BoxFuture<'a, Result<String, String>>;
}

pub fn resolve_provider(config: &LlmProviderConfig) -> Box<dyn AiProvider> {
    match config {
        LlmProviderConfig::Ollama { base_url, model } => {
            Box::new(ollama::OllamaProvider::new(base_url.clone(), model.clone()))
        }
        LlmProviderConfig::OpenAiCompatible { base_url, api_key, model } => {
            let b_lower = base_url.to_lowercase();
            if b_lower.contains("anthropic.com") {
                Box::new(anthropic::AnthropicProvider::new(base_url.clone(), api_key.clone(), model.clone()))
            } else if b_lower.contains("gemini") || b_lower.contains("generativelanguage.googleapis.com") {
                Box::new(gemini::GeminiProvider::new(base_url.clone(), api_key.clone(), model.clone()))
            } else {
                // OpenAI, OpenRouter, Groq, DeepSeek, Custom share OpenAI-compatible implementation
                Box::new(openai_compatible::OpenAiCompatibleProvider::new(
                    base_url.clone(),
                    api_key.clone(),
                    model.clone(),
                ))
            }
        }
    }
}
