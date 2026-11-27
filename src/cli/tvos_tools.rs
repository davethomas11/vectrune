//! Device, signing and diagnostic helpers for the Apple TV commands.
use anyhow::{bail, ensure, Context, Result};
use std::io::Write;
use std::path::Path;
use std::process::{Command as Process, Stdio};

#[derive(Debug, Clone)]
pub struct Device {
    pub udid: String,
    pub name: String,
    pub model: String,
    pub physical: bool,
    pub paired: bool,
}

pub fn parse_devices(json: &str) -> Result<Vec<Device>> {
    let value: serde_json::Value = serde_json::from_str(json).context("Unreadable device list")?;
    let list = value["result"]["devices"].as_array().cloned().unwrap_or_default();
    Ok(list
        .iter()
        .filter(|d| d["hardwareProperties"]["platform"] == "tvOS")
        .filter_map(|d| {
            let hardware = &d["hardwareProperties"];
            let udid = hardware["udid"].as_str().or_else(|| d["identifier"].as_str())?;
            Some(Device {
                udid: udid.to_string(),
                name: d["deviceProperties"]["name"].as_str().unwrap_or(udid).to_string(),
                model: hardware["marketingName"].as_str().unwrap_or("Apple TV").to_string(),
                physical: hardware["reality"] == "physical",
                paired: d["connectionProperties"]["pairingState"] == "paired",
            })
        })
        .collect())
}

pub fn list_devices() -> Result<Vec<Device>> {
    let file = std::env::temp_dir().join(format!("vectrune-devices-{}.json", std::process::id()));
    let status = Process::new("xcrun")
        .args(["devicectl", "list", "devices", "--quiet", "--json-output"])
        .arg(&file)
        .status()
        .context("Could not start devicectl; install and select Xcode")?;
    let json = std::fs::read_to_string(&file);
    let _ = std::fs::remove_file(&file);
    ensure!(status.success(), "Device listing failed with {status}");
    parse_devices(&json.context("Device listing produced no output")?)
}

/// Hex digits and dashes are treated as a device identifier; anything else is a device name.
pub fn looks_like_identifier(value: &str) -> bool {
    !value.is_empty() && value.bytes().all(|c| c.is_ascii_hexdigit() || c == b'-')
}

pub fn pick_device(devices: &[Device], requested: Option<&str>) -> Result<String> {
    let physical: Vec<&Device> = devices.iter().filter(|d| d.physical && d.paired).collect();
    let names = |items: &[&Device]| items.iter().map(|d| format!("{} ({})", d.name, d.model)).collect::<Vec<_>>().join(", ");
    match requested {
        Some(wanted) => devices
            .iter()
            .find(|d| d.udid.eq_ignore_ascii_case(wanted) || d.name.eq_ignore_ascii_case(wanted))
            .map(|d| d.udid.clone())
            .with_context(|| format!("No Apple TV named {wanted:?}; available: {}", names(&physical))),
        None => match physical.as_slice() {
            [only] => Ok(only.udid.clone()),
            [] => bail!("No paired Apple TV found; pair one in Xcode or pass --device"),
            many => bail!("Several Apple TVs are paired ({}); pass --device or set `device` in tvos.toml", names(many)),
        },
    }
}

pub fn resolve_device(requested: Option<&str>) -> Result<String> {
    if let Some(value) = requested.filter(|v| looks_like_identifier(v)) {
        return Ok(value.to_string());
    }
    pick_device(&list_devices()?, requested)
}

fn stdout_of(program: &str, args: &[&str]) -> Option<String> {
    let output = Process::new(program).args(args).output().ok()?;
    output.status.success().then(|| String::from_utf8_lossy(&output.stdout).into_owned())
}

pub fn first_line(program: &str, args: &[&str]) -> Option<String> {
    stdout_of(program, args).and_then(|text| text.lines().next().map(str::to_string))
}

/// Development team IDs found in the keychain's code-signing certificates, as (identity, team).
pub fn signing_teams() -> Vec<(String, String)> {
    let Some(listing) = stdout_of("security", &["find-identity", "-v", "-p", "codesigning"]) else {
        return Vec::new();
    };
    let mut found: Vec<(String, String)> = Vec::new();
    for line in listing.lines() {
        let Some(identity) = line.split('"').nth(1) else { continue };
        if !identity.starts_with("Apple Development") && !identity.starts_with("Apple Distribution") {
            continue;
        }
        let Some(pem) = stdout_of("security", &["find-certificate", "-c", identity, "-p"]) else { continue };
        let Ok(mut child) = Process::new("openssl")
            .args(["x509", "-noout", "-subject"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
        else {
            continue;
        };
        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(pem.as_bytes());
        }
        let Ok(output) = child.wait_with_output() else { continue };
        let subject = String::from_utf8_lossy(&output.stdout);
        if let Some(team) = team_from_subject(&subject) {
            if !found.iter().any(|(i, t)| i == identity && *t == team) {
                found.push((identity.to_string(), team));
            }
        }
    }
    found
}

pub fn team_from_subject(subject: &str) -> Option<String> {
    let rest = subject.split("OU=").nth(1)?;
    let team: String = rest.chars().take_while(|c| c.is_ascii_alphanumeric()).collect();
    (team.len() == 10).then_some(team)
}

pub fn rust_target_installed(target: &str) -> bool {
    stdout_of("rustc", &["--print", "target-libdir", "--target", target])
        .is_some_and(|dir| Path::new(dir.trim()).is_dir())
}

#[derive(Debug, Default, PartialEq)]
pub struct Stats {
    pub fps: f64,
    pub simulation_ms: f64,
    pub native_ms: f64,
    pub memory_mb: f64,
}

/// Parses the host's `Rune stats: fps=27.3 sim_ms=4 native_ms=20 memory_mb=118` log lines.
pub fn parse_stats(line: &str) -> Option<Stats> {
    let rest = line.split("Rune stats:").nth(1)?;
    let mut stats = Stats::default();
    let mut fps = false;
    for pair in rest.split_whitespace() {
        let Some((key, value)) = pair.split_once('=') else { continue };
        let Ok(value) = value.parse::<f64>() else { continue };
        match key {
            "fps" => {
                stats.fps = value;
                fps = true;
            }
            "sim_ms" => stats.simulation_ms = value,
            "native_ms" => stats.native_ms = value,
            "memory_mb" => stats.memory_mb = value,
            _ => {}
        }
    }
    fps.then_some(stats)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stats_lines_parse_and_other_lines_are_ignored() {
        let stats = parse_stats("2026 Glowtide[1:2] Rune stats: fps=27.5 sim_ms=4 native_ms=20.5 memory_mb=118").unwrap();
        assert_eq!(stats, Stats { fps: 27.5, simulation_ms: 4.0, native_ms: 20.5, memory_mb: 118.0 });
        assert!(parse_stats("Rune probe rendering frame").is_none());
    }

    #[test]
    fn team_is_read_from_the_certificate_subject() {
        let subject = "subject=UID=58RDAKYFTP, CN=Apple Development: a@b.c (V65BQH6K6H), OU=674TLB2R9M, O=Dave, C=US";
        assert_eq!(team_from_subject(subject).as_deref(), Some("674TLB2R9M"));
        assert!(team_from_subject("subject=CN=x").is_none());
    }

    #[test]
    fn device_selection_prefers_the_only_physical_paired_tv() {
        let json = r#"{"result":{"devices":[
          {"identifier":"S","hardwareProperties":{"platform":"tvOS","reality":"simulated","udid":"SIM-1"},"connectionProperties":{"pairingState":"paired"},"deviceProperties":{"name":"Simulator"}},
          {"identifier":"P","hardwareProperties":{"platform":"tvOS","reality":"physical","udid":"00AA-11","marketingName":"Apple TV 4K"},"connectionProperties":{"pairingState":"paired"},"deviceProperties":{"name":"Main Floor"}},
          {"identifier":"X","hardwareProperties":{"platform":"iOS","reality":"physical","udid":"PHONE"},"connectionProperties":{"pairingState":"paired"},"deviceProperties":{"name":"Phone"}}]}}"#;
        let devices = parse_devices(json).unwrap();
        assert_eq!(devices.len(), 2);
        assert_eq!(pick_device(&devices, None).unwrap(), "00AA-11");
        assert_eq!(pick_device(&devices, Some("main floor")).unwrap(), "00AA-11");
        assert!(pick_device(&devices, Some("Bedroom")).is_err());
        assert!(looks_like_identifier("00AA-11") && !looks_like_identifier("Main Floor"));
    }
}
