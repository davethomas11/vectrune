use std::{
    net::TcpListener,
    process::{Child, Command, Stdio},
    time::Duration,
};

struct Running(Child);
impl Drop for Running {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}
fn port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port()
}
fn app(path: &std::path::Path, port: u16, label: &str) {
    std::fs::write(path, format!("@App\ntype = REST\nhost = 127.0.0.1\nport = {port}\n@Route/GET /health\nrun:\n    respond 200 \"{label}\"\n")).unwrap();
}

#[tokio::test]
async fn secondary_apps_keep_separate_routes_and_ports() {
    let dir = tempfile::tempdir().unwrap();
    let mut paths = Vec::new();
    let mut ports = Vec::new();
    for name in ["primary", "second", "third"] {
        let p = port();
        let path = dir.path().join(format!("{name}.rune"));
        app(&path, p, name);
        paths.push(path);
        ports.push(p);
    }
    let mut child = Running(
        Command::new(assert_cmd::cargo::cargo_bin!("vectrune"))
            .arg(&paths[0])
            .arg("--secondary-app")
            .arg(&paths[1])
            .arg("--secondary-app")
            .arg(&paths[2])
            .arg("--watch")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .unwrap(),
    );
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .unwrap();
    for (index, name) in ["primary", "second", "third"].iter().enumerate() {
        let endpoint = format!("http://127.0.0.1:{}/health", ports[index]);
        let mut body = None;
        for _ in 0..100 {
            assert!(
                child.0.try_wait().unwrap().is_none(),
                "application group exited early"
            );
            if let Ok(response) = client.get(&endpoint).send().await {
                body = Some(response.text().await.unwrap());
                break;
            }
            tokio::time::sleep(Duration::from_millis(30)).await;
        }
        assert_eq!(body.as_deref(), Some(*name));
    }
    app(&paths[0], ports[0], "primary-updated");
    let mut restarted = false;
    for _ in 0..100 {
        if let Ok(response) = client
            .get(format!("http://127.0.0.1:{}/health", ports[0]))
            .send()
            .await
        {
            if response.text().await.unwrap() == "primary-updated" {
                restarted = true;
                break;
            }
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    assert!(restarted, "watch did not reload the application group");
    #[cfg(unix)]
    {
        assert!(Command::new("kill")
            .args(["-INT", &child.0.id().to_string()])
            .status()
            .unwrap()
            .success());
        let mut stopped = false;
        for _ in 0..100 {
            if let Some(status) = child.0.try_wait().unwrap() {
                assert!(status.success());
                stopped = true;
                break;
            }
            tokio::time::sleep(Duration::from_millis(30)).await;
        }
        assert!(stopped, "Ctrl-C did not stop the group");
        for p in ports {
            assert!(TcpListener::bind(("127.0.0.1", p)).is_ok());
        }
    }
}

#[test]
fn occupied_secondary_port_fails_the_group_and_releases_primary_port() {
    let dir = tempfile::tempdir().unwrap();
    let primary = dir.path().join("primary.rune");
    let secondary = dir.path().join("secondary.rune");
    let reserved = TcpListener::bind("127.0.0.1:0").unwrap();
    let primary_port = port();
    app(&primary, primary_port, "primary");
    app(
        &secondary,
        reserved.local_addr().unwrap().port(),
        "secondary",
    );
    let output = Command::new(assert_cmd::cargo::cargo_bin!("vectrune"))
        .arg(primary)
        .arg("--secondary-app")
        .arg(secondary)
        .output()
        .unwrap();
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).contains("cannot bind"));
    assert!(TcpListener::bind(("127.0.0.1", primary_port)).is_ok());
}
