use base64::Engine;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread;
use tauri::{AppHandle, Manager, PhysicalPosition};

#[derive(Clone, Serialize, Deserialize)]
#[serde(untagged)]
enum SubtaskSyncPayload {
    Title(String),
    Detail {
        title: String,
        #[serde(default)]
        status: Option<String>,
    },
}

#[derive(Clone, Serialize, Deserialize)]
struct TaskSyncPayload {
    #[serde(default)]
    sync_id: Option<String>,
    title: String,
    duration_minutes: u32,
    mode: String,
    subtasks: Vec<SubtaskSyncPayload>,
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    elapsed_seconds: Option<u32>,
    #[serde(default)]
    focused: Option<bool>,
    #[serde(default)]
    updated_at_ms: Option<u64>,
}

#[derive(Deserialize)]
struct TaskSyncEnvelope {
    source: String,
    task: TaskSyncPayload,
}

#[derive(Deserialize)]
struct ImageGenerationApiResponse {
    data: Vec<ImageGenerationItem>,
}

#[derive(Deserialize)]
struct ImageApiErrorEnvelope {
    #[serde(default)]
    error: Option<ImageApiErrorBody>,
    #[serde(default)]
    message: Option<String>,
}

#[derive(Deserialize)]
struct ImageApiErrorBody {
    #[serde(default)]
    message: Option<String>,
}

#[derive(Deserialize)]
struct ImageGenerationItem {
    #[serde(default)]
    b64_json: Option<String>,
    #[serde(default)]
    url: Option<String>,
}

#[derive(Clone, Default)]
struct BridgeState {
    island_visible: Arc<AtomicBool>,
    web_to_island_tasks: Arc<Mutex<Vec<TaskSyncPayload>>>,
    island_to_web_tasks: Arc<Mutex<Vec<TaskSyncPayload>>>,
}

fn write_response(
    mut stream: TcpStream,
    status: &str,
    content_type: &str,
    body: &str,
) -> std::io::Result<()> {
    let response = format!(
        "HTTP/1.1 {}\r\nContent-Type: {}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        status,
        content_type,
        body.len(),
        body
    );
    stream.write_all(response.as_bytes())
}

fn parse_query(query: &str) -> HashMap<String, String> {
    query
        .split('&')
        .filter_map(|pair| {
            let mut parts = pair.splitn(2, '=');
            let key = parts.next()?.trim();
            let value = parts.next().unwrap_or_default().trim();
            if key.is_empty() {
                None
            } else {
                Some((key.to_string(), value.to_string()))
            }
        })
        .collect()
}

fn handle_bridge_request(stream: TcpStream, app: &AppHandle, state: &BridgeState) {
    let mut reader = BufReader::new(match stream.try_clone() {
        Ok(s) => s,
        Err(_) => return,
    });

    let mut first_line = String::new();
    if reader.read_line(&mut first_line).is_err() || first_line.is_empty() {
        return;
    }

    let mut headers: HashMap<String, String> = HashMap::new();
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line).is_err() {
            return;
        }
        if line == "\r\n" || line.is_empty() {
            break;
        }
        if let Some((name, value)) = line.split_once(':') {
            headers.insert(name.trim().to_ascii_lowercase(), value.trim().to_string());
        }
    }

    let mut parts = first_line.split_whitespace();
    let method = parts.next().unwrap_or_default();
    let full_path = parts.next().unwrap_or_default();

    let (path, query_string) = match full_path.split_once('?') {
        Some((p, q)) => (p, q),
        None => (full_path, ""),
    };
    let query = parse_query(query_string);

    let content_length = headers
        .get("content-length")
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(0);

    let mut body = String::new();
    if content_length > 0 {
        let mut buffer = vec![0u8; content_length];
        if reader.read_exact(&mut buffer).is_ok() {
            body = String::from_utf8_lossy(&buffer).to_string();
        }
    }

    if method == "OPTIONS" {
        let _ = write_response(stream, "204 No Content", "text/plain", "");
        return;
    }

    let window = app.get_webview_window("main");

    match (method, path) {
        ("GET", "/health") => {
            let _ = write_response(stream, "200 OK", "application/json", r#"{"ok":true}"#);
        }
        ("GET", "/island/state") => {
            let visible = state.island_visible.load(Ordering::Relaxed);
            let body = format!(r#"{{"visible":{}}}"#, if visible { "true" } else { "false" });
            let _ = write_response(stream, "200 OK", "application/json", &body);
        }
        ("POST", "/island/show") => {
            if let Some(window) = window {
                let _ = window.show();
            }
            state.island_visible.store(true, Ordering::Relaxed);
            let _ = write_response(stream, "200 OK", "application/json", r#"{"visible":true}"#);
        }
        ("POST", "/island/hide") => {
            if let Some(window) = window {
                let _ = window.hide();
            }
            state.island_visible.store(false, Ordering::Relaxed);
            let _ = write_response(stream, "200 OK", "application/json", r#"{"visible":false}"#);
        }
        ("POST", "/island/toggle") => {
            let next = !state.island_visible.load(Ordering::Relaxed);
            if let Some(window) = window {
                if next {
                    let _ = window.show();
                } else {
                    let _ = window.hide();
                }
            }
            state.island_visible.store(next, Ordering::Relaxed);
            let body = format!(r#"{{"visible":{}}}"#, if next { "true" } else { "false" });
            let _ = write_response(stream, "200 OK", "application/json", &body);
        }
        ("POST", "/tasks/create") => {
            let parsed = serde_json::from_str::<TaskSyncEnvelope>(&body);
            let Ok(envelope) = parsed else {
                let _ = write_response(
                    stream,
                    "400 Bad Request",
                    "application/json",
                    r#"{"error":"invalid_body"}"#,
                );
                return;
            };

            match envelope.source.as_str() {
                "web" => {
                    if let Ok(mut q) = state.web_to_island_tasks.lock() {
                        q.push(envelope.task);
                    }
                }
                "island" => {
                    if let Ok(mut q) = state.island_to_web_tasks.lock() {
                        q.push(envelope.task);
                    }
                }
                _ => {
                    let _ = write_response(
                        stream,
                        "400 Bad Request",
                        "application/json",
                        r#"{"error":"invalid_source"}"#,
                    );
                    return;
                }
            }

            let _ = write_response(stream, "200 OK", "application/json", r#"{"ok":true}"#);
        }
        ("GET", "/tasks/pull") => {
            let Some(target) = query.get("target") else {
                let _ = write_response(
                    stream,
                    "400 Bad Request",
                    "application/json",
                    r#"{"error":"missing_target"}"#,
                );
                return;
            };

            let tasks = if target == "web" {
                if let Ok(mut q) = state.island_to_web_tasks.lock() {
                    q.drain(..).collect::<Vec<_>>()
                } else {
                    Vec::new()
                }
            } else if target == "island" {
                if let Ok(mut q) = state.web_to_island_tasks.lock() {
                    q.drain(..).collect::<Vec<_>>()
                } else {
                    Vec::new()
                }
            } else {
                let _ = write_response(
                    stream,
                    "400 Bad Request",
                    "application/json",
                    r#"{"error":"invalid_target"}"#,
                );
                return;
            };

            let body = serde_json::json!({ "tasks": tasks }).to_string();
            let _ = write_response(stream, "200 OK", "application/json", &body);
        }
        _ => {
            let _ = write_response(
                stream,
                "404 Not Found",
                "application/json",
                r#"{"error":"not_found"}"#,
            );
        }
    }
}

fn start_bridge_server(app: AppHandle, state: BridgeState) {
    thread::spawn(move || {
        let listener = match TcpListener::bind("127.0.0.1:43141") {
            Ok(listener) => listener,
            Err(_) => return,
        };

        for incoming in listener.incoming() {
            let Ok(stream) = incoming else {
                continue;
            };
            handle_bridge_request(stream, &app, &state);
        }
    });
}

fn load_env_files() {
    let _ = dotenvy::from_filename(".env");
    let _ = dotenvy::from_filename(".env.local");
    let _ = dotenvy::from_filename("web/.env");
    let _ = dotenvy::from_filename("web/.env.local");
    let _ = dotenvy::from_filename("web/src/lib/.env");
    let _ = dotenvy::from_filename("web/src/lib/.env.local");
}

fn load_image_api_key() -> Option<String> {
    load_env_files();

    env::var("VORTEXAI_API_KEY")
        .or_else(|_| env::var("IMAGE_API_KEY"))
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn load_image_api_host() -> String {
    load_env_files();

    env::var("VORTEXAI_API_HOST")
        .ok()
        .map(|value| value.trim().trim_end_matches('/').to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "https://vortexaiapi.com/v1".to_string())
}

fn load_image_model() -> String {
    load_env_files();

    env::var("VORTEXAI_IMAGE_MODEL")
        .or_else(|_| env::var("IMAGE_API_MODEL"))
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "gpt-image-2-2026-04-21".to_string())
}

fn to_data_url(content_type: &str, bytes: &[u8]) -> String {
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    format!("data:{};base64,{}", content_type, encoded)
}

fn summarize_image_api_error(status: reqwest::StatusCode, body: &str) -> String {
    let parsed = serde_json::from_str::<ImageApiErrorEnvelope>(body).ok();
    let raw_message = parsed
        .as_ref()
        .and_then(|payload| {
            payload
                .error
                .as_ref()
                .and_then(|error| error.message.as_ref())
                .or(payload.message.as_ref())
        })
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| body.trim().to_string());

    let normalized = raw_message.to_lowercase();

    if status.as_u16() == 401 || normalized.contains("incorrect api key") || normalized.contains("unauthorized") {
        return "图片生成失败：API Key 无效或已过期，请检查 .env.local 里的 VORTEXAI_API_KEY。".to_string();
    }

    if status.as_u16() == 429 || normalized.contains("rate limit") || normalized.contains("quota") {
        return "图片生成失败：当前请求太频繁或额度不足，请稍后再试。".to_string();
    }

    if status.as_u16() == 400 || normalized.contains("invalid") || normalized.contains("unsupported") {
        return format!("图片生成失败：请求参数有误。{}", raw_message);
    }

    if status.is_server_error() {
        return "图片生成失败：图片服务暂时不可用，请稍后再试。".to_string();
    }

    if raw_message.is_empty() {
        return format!("图片生成失败：图片服务返回异常（{}）。", status);
    }

    format!("图片生成失败：{}", raw_message)
}

fn summarize_network_error(error: &reqwest::Error) -> String {
    if error.is_timeout() {
        return "图片生成超时了，请稍后重试。".to_string();
    }

    if error.is_connect() {
        return "连接图片服务失败，请检查网络或接口地址配置。".to_string();
    }

    format!("图片请求失败：{}", error)
}

#[tauri::command]
async fn generate_daily_report_image(prompt: String) -> Result<String, String> {
    let api_key = load_image_api_key().ok_or_else(|| {
        "没有读取到图片 API Key。请在 .env.local 里配置 VORTEXAI_API_KEY。".to_string()
    })?;
    let api_host = load_image_api_host();
    let image_model = load_image_model();

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/images/generations", api_host))
        .header(AUTHORIZATION, format!("Bearer {}", api_key))
        .header(CONTENT_TYPE, "application/json")
        .json(&serde_json::json!({
            "model": image_model,
            "prompt": prompt,
            "size": "1024x1280"
        }))
        .send()
        .await
        .map_err(|error| summarize_network_error(&error))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Failed to read error response".to_string());
        return Err(summarize_image_api_error(status, &body));
    }

    let payload: ImageGenerationApiResponse = response
        .json()
        .await
        .map_err(|error| format!("图片服务返回的数据解析失败：{}", error))?;

    let image_item = payload
        .data
        .into_iter()
        .next()
        .ok_or_else(|| "图片服务没有返回可展示的图片数据。".to_string())?;

    if let Some(image_base64) = image_item
        .b64_json
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        return Ok(format!("data:image/png;base64,{}", image_base64));
    }

    if let Some(image_url) = image_item
        .url
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        let image_response = client
            .get(&image_url)
            .send()
            .await
            .map_err(|error| format!("图片已生成，但下载图片失败：{}", summarize_network_error(&error)))?;

        if !image_response.status().is_success() {
            let status = image_response.status();
            let body = image_response
                .text()
                .await
                .unwrap_or_else(|_| "Failed to read image download error response".to_string());
            return Err(format!("图片已生成，但下载图片失败。{}", summarize_image_api_error(status, &body)));
        }

        let content_type = image_response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .map(|value| value.to_string())
            .unwrap_or_else(|| "image/png".to_string());

        let image_bytes = image_response
            .bytes()
            .await
            .map_err(|error| format!("Failed to read generated image bytes: {}", error))?;

        return Ok(to_data_url(&content_type, &image_bytes));
    }

    Err("图片服务返回成功了，但没有拿到图片地址或图片数据。".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            let bridge_state = BridgeState::default();

            if let Some(monitor) = window.current_monitor()? {
                let monitor_size = monitor.size();
                let window_size = window.outer_size()?;
                let centered_x = ((monitor_size.width.saturating_sub(window_size.width)) / 2) as i32;
                window.set_position(PhysicalPosition::new(centered_x, 0))?;
            }

            window.show()?;
            bridge_state.island_visible.store(true, Ordering::Relaxed);
            start_bridge_server(app.handle().clone(), bridge_state);

            #[cfg(debug_assertions)]
            {
                window.open_devtools();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![generate_daily_report_image])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
