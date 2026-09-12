pub mod ollama;
pub mod state;

use serde::{Deserialize, Serialize};

/// Configuration for which LLM provider to use for a recipe execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "config")]
pub enum LlmProviderConfig {
    Ollama {
        base_url: String, // Default: "http://localhost:11434"
        model: String,
    },
    OpenAiCompatible {
        base_url: String, // Supports OpenRouter, DeepSeek, OpenAI, Groq, Gemini, Anthropic
        api_key: String,
        model: String,
    },
}

fn default_priority() -> String {
    "medium".to_string()
}

/// A single extracted task from AI processing.
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ExtractedTaskPayload {
    #[serde(default)]
    pub title: String,
    #[serde(default = "default_priority")]
    pub priority: String, // "low" | "medium" | "high"
    #[serde(default)]
    pub due_date: Option<String>,
}

/// Structured output contract for all AI recipe operations.
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct RecipeOutput {
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub extracted_tasks: Vec<ExtractedTaskPayload>,
    #[serde(default)]
    pub markdown_content: Option<String>,
}
