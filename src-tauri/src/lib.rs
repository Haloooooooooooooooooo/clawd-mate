use reqwest::header::AUTHORIZATION;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::time::Duration;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread;
use tauri::{AppHandle, Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder};
use tauri::Url;

fn position_main_window_at_top_center(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    if let Some(monitor) = window.current_monitor()? {
        let monitor_size = monitor.size();
        let monitor_position = monitor.position();
        let window_size = window.outer_size()?;
        let centered_x =
            monitor_position.x + ((monitor_size.width.saturating_sub(window_size.width)) / 2) as i32;
        window.set_position(PhysicalPosition::new(centered_x, monitor_position.y))?;
    }

    Ok(())
}

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
struct ReportGenerateEnvelope {
    prompt: String,
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
                let _ = position_main_window_at_top_center(&window);
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
                    let _ = position_main_window_at_top_center(&window);
                    let _ = window.show();
                } else {
                    let _ = window.hide();
                }
            }
            state.island_visible.store(next, Ordering::Relaxed);
            let body = format!(r#"{{"visible":{}}}"#, if next { "true" } else { "false" });
            let _ = write_response(stream, "200 OK", "application/json", &body);
        }
        ("POST", "/dashboard/show") => {
            if let Some(dashboard_window) = app.get_webview_window("dashboard") {
                let _ = dashboard_window.show();
                let _ = dashboard_window.set_focus();
                let _ = dashboard_window.eval(
                    "window.location.replace('http://127.0.0.1:5173/app/dashboard')",
                );
                let _ = write_response(stream, "200 OK", "application/json", r#"{"ok":true}"#);
            } else {
                let _ = write_response(
                    stream,
                    "404 Not Found",
                    "application/json",
                    r#"{"error":"dashboard_not_found"}"#,
                );
            }
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
        ("POST", "/reports/generate") => {
            let parsed = serde_json::from_str::<ReportGenerateEnvelope>(&body);
            let Ok(envelope) = parsed else {
                let _ = write_response(
                    stream,
                    "400 Bad Request",
                    "application/json",
                    r#"{"error":"invalid_body"}"#,
                );
                return;
            };

            println!(
                "[daily-report] bridge request received prompt_length={}",
                envelope.prompt.chars().count()
            );

            match tauri::async_runtime::block_on(generate_daily_report_image(envelope.prompt)) {
                Ok(image_data_url) => {
                    println!(
                        "[daily-report] bridge request success image_length={}",
                        image_data_url.len()
                    );
                    let body = serde_json::json!({ "imageDataUrl": image_data_url }).to_string();
                    let _ = write_response(stream, "200 OK", "application/json", &body);
                }
                Err(message) => {
                    println!("[daily-report] bridge request failed message={}", message);
                    let body = serde_json::json!({ "error": message }).to_string();
                    let _ = write_response(
                        stream,
                        "500 Internal Server Error",
                        "application/json",
                        &body,
                    );
                }
            }
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

fn find_reference_image_path() -> Option<PathBuf> {
    let candidates = [
        PathBuf::from("png/clawd-ref.png"),
        PathBuf::from("../png/clawd-ref.png"),
        PathBuf::from("./png/clawd-ref.png"),
        PathBuf::from("png/clawd.png"),
        PathBuf::from("../png/clawd.png"),
        PathBuf::from("./png/clawd.png"),
    ];

    candidates
        .into_iter()
        .find(|path| path.exists() && path.is_file())
}

fn load_reference_image_part() -> Result<reqwest::multipart::Part, String> {
    let path = find_reference_image_path()
        .ok_or_else(|| "没有找到参考图 png/clawd.png，请确认文件存在。".to_string())?;

    let bytes = fs::read(&path)
        .map_err(|error| format!("读取参考图失败：{} ({})", path.display(), error))?;

    let filename = Path::new(&path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("clawd.png")
        .to_string();

    reqwest::multipart::Part::bytes(bytes)
        .file_name(filename)
        .mime_str("image/png")
        .map_err(|error| format!("构建参考图上传数据失败：{}", error))
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

    if status.as_u16() == 524 || normalized.contains("bad_response_status_code") {
        return "图片服务处理超时了。这次请求已经发到服务端，但服务端没有及时返回，请稍后重试。".to_string();
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
        return "图片生成超时了。这个图片服务返回较慢，请稍后再试，或适当等待更久。".to_string();
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

    println!(
        "[daily-report] start host={} model={} prompt_length={}",
        api_host,
        image_model,
        prompt.chars().count()
    );

    let reference_image = load_reference_image_part()?;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(180))
        .build()
        .map_err(|error| format!("创建图片请求客户端失败：{}", error))?;
    let form = reqwest::multipart::Form::new()
        .text("model", image_model.clone())
        .text("prompt", prompt)
        .text("size", "1024x1280")
        .part("image", reference_image);

    let response = client
        .post(format!("{}/images/edits", api_host))
        .header(AUTHORIZATION, format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await
        .map_err(|error| {
            let message = summarize_network_error(&error);
            println!("[daily-report] network error message={}", message);
            message
        })?;

    println!("[daily-report] response status={}", response.status());

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Failed to read error response".to_string());
        println!(
            "[daily-report] response error status={} body={}",
            status,
            body
        );
        return Err(summarize_image_api_error(status, &body));
    }

    let payload: ImageGenerationApiResponse = response
        .json()
        .await
        .map_err(|error| {
            let message = format!("图片服务返回的数据解析失败：{}", error);
            println!("[daily-report] parse error message={}", message);
            message
        })?;

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
        println!(
            "[daily-report] success source=b64_json length={}",
            image_base64.len()
        );
        return Ok(format!("data:image/png;base64,{}", image_base64));
    }

    if let Some(image_url) = image_item
        .url
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        println!("[daily-report] success source=url value={}", image_url);
        return Ok(image_url);
    }

    println!("[daily-report] success response missing image url and b64_json");
    Err("图片服务返回成功了，但没有拿到图片地址或图片数据。".to_string())
}

#[tauri::command]
fn debug_resize_main_window(app: AppHandle, width: f64, height: f64) -> Result<String, String> {
    let Some(window) = app.get_webview_window("main") else {
        return Err("main window not found".to_string());
    };

    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize::new(width, height)))
        .map_err(|error| error.to_string())?;

    let outer = window.outer_size().map_err(|error| error.to_string())?;
    let message = format!(
        "target={}x{}, actual={}x{}",
        width, height, outer.width, outer.height
    );
    println!("[island-window] {}", message);
    Ok(message)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            let bridge_state = BridgeState::default();
            let dashboard_url = Url::parse("http://127.0.0.1:5173").expect("invalid dashboard dev url");

            position_main_window_at_top_center(&window)?;

            window.show()?;
            bridge_state.island_visible.store(true, Ordering::Relaxed);
            start_bridge_server(app.handle().clone(), bridge_state);

            if app.get_webview_window("dashboard").is_none() {
                WebviewWindowBuilder::new(
                    app,
                    "dashboard",
                    WebviewUrl::External(dashboard_url),
                )
                .title("ClawdMate")
                .inner_size(1440.0, 960.0)
                .min_inner_size(1080.0, 720.0)
                .resizable(true)
                .decorations(true)
                .transparent(false)
                .always_on_top(false)
                .center()
                .build()?;
            }

            #[cfg(debug_assertions)]
            {
                if let Some(dashboard_window) = app.get_webview_window("dashboard") {
                    dashboard_window.open_devtools();
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            generate_daily_report_image,
            debug_resize_main_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
