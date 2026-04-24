use tauri::{Manager, PhysicalPosition};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            if let Some(monitor) = window.current_monitor()? {
                let monitor_size = monitor.size();
                let window_size = window.outer_size()?;
                let centered_x = ((monitor_size.width.saturating_sub(window_size.width)) / 2) as i32;
                window.set_position(PhysicalPosition::new(centered_x, 0))?;
            }

            window.show()?;

            #[cfg(debug_assertions)]
            {
                window.open_devtools();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
