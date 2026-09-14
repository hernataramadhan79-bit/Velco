use tokio_util::sync::CancellationToken;

use super::openai_compatible::OpenAiCompatibleProvider;
use super::{AiProvider, BoxFuture, ChatMessagePayload, ExtractedImage};

pub struct GeminiProvider {
    inner: OpenAiCompatibleProvider,
}

impl GeminiProvider {
    pub fn new(base_url: String, api_key: String, model: String) -> Self {
        let effective_url = if base_url.trim().is_empty() {
            "https://generativelanguage.googleapis.com/v1beta/openai".to_string()
        } else {
            base_url
        };
        Self {
            inner: OpenAiCompatibleProvider::new(effective_url, api_key, model),
        }
    }
}

impl AiProvider for GeminiProvider {
    fn id(&self) -> &str {
        "gemini"
    }

    fn is_cloud(&self) -> bool {
        true
    }

    fn model(&self) -> &str {
        &self.inner.model
    }

    fn completion<'a>(
        &'a self,
        client: &'a reqwest::Client,
        system_prompt: &'a str,
        user_prompt: &'a str,
        images: &'a [ExtractedImage],
    ) -> BoxFuture<'a, Result<String, String>> {
        self.inner.completion(client, system_prompt, user_prompt, images)
    }

    fn stream_chat<'a>(
        &'a self,
        client: &'a reqwest::Client,
        system_prompt: &'a str,
        messages: &'a [ChatMessagePayload],
        images: &'a [ExtractedImage],
        app: &'a tauri::AppHandle,
        request_id: &'a str,
        cancel_token: &'a CancellationToken,
    ) -> BoxFuture<'a, Result<String, String>> {
        self.inner.stream_chat(
            client,
            system_prompt,
            messages,
            images,
            app,
            request_id,
            cancel_token,
        )
    }
}
