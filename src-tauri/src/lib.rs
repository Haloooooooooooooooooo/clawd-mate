use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread;
use tauri::{AppHandle, Manager, PhysicalPosition};

#[derive(Clone, Serialize, Deserialize)]
struct TaskSyncPayload {
    title: String,
    duration_minutes: u32,
    mode: String,
    subtasks: Vec<String>,
}

#[derive(Deserialize)]
struct TaskSyncEnvelope {
    source: String,
    task: TaskSyncPayload,
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
