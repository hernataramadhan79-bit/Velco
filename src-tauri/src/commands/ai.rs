use crate::ai::ollama::{ConnectionTestResult, DetailedModelInfo, OllamaClient};

#[tauri::command]
pub async fn check_ollama_status(
    base_url: Option<String>,
    api_key: Option<String>,
) -> Result<bool, String> {
    let client = OllamaClient::new(base_url, api_key);
    Ok(client.check_health().await)
}

#[tauri::command]
pub async fn list_ollama_models(
    base_url: Option<String>,
    api_key: Option<String>,
) -> Result<Vec<String>, String> {
    let client = OllamaClient::new(base_url, api_key);
    client.list_models().await
}

#[tauri::command]
pub async fn list_ai_models_detailed(
    base_url: Option<String>,
    api_key: Option<String>,
    provider: Option<String>,
) -> Result<Vec<DetailedModelInfo>, String> {
    let client = OllamaClient::new(base_url, api_key);
    client.list_detailed_models(provider.as_deref()).await
}

#[tauri::command]
pub async fn generate_ai_completion(
    base_url: Option<String>,
    model: String,
    prompt: String,
    api_key: Option<String>,
) -> Result<String, String> {
    let client = OllamaClient::new(base_url, api_key);
    client.generate(&model, &prompt).await
}

#[tauri::command]
pub async fn test_ai_connection(
    base_url: Option<String>,
    api_key: Option<String>,
    provider: Option<String>,
    model: Option<String>,
) -> Result<ConnectionTestResult, String> {
    let client = OllamaClient::new(base_url, api_key);
    client.test_connection(provider.as_deref(), model.as_deref()).await
}
