//! Cell-based terminal animation driven by the shared Rune action interpreter.
use crate::{
    apps::pixel::native_audio::{Bridge, Output, Tone},
    apps::rune_web::{
        ast::{ActionStep, LogicDefinition, ViewNode},
        jscodegen::JsCodegen,
        parser::parse_logic_section,
    },
    rune_ast::{RuneDocument, Value},
};
use anyhow::{anyhow, ensure, Context as _, Result};
use crossterm::{
    cursor::{Hide, MoveTo, Show},
    event::{self, Event, KeyCode, KeyEventKind, KeyModifiers},
    execute, queue,
    style::{Color, ResetColor, SetForegroundColor},
    terminal::{self, Clear, ClearType, EnterAlternateScreen, LeaveAlternateScreen},
};
use rquickjs::{CaughtError, Context, Runtime};
use serde::Deserialize;
use serde_json::Value as Json;
use std::{
    collections::HashMap,
    io::{self, IsTerminal, Write},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
pub mod ascii3d;

#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Ink {
    #[default]
    White,
    Gray,
    Red,
    Green,
    Yellow,
    Blue,
    Magenta,
    Cyan,
}
impl Ink {
    fn terminal(self) -> Color {
        match self {
            Self::White => Color::White,
            Self::Gray => Color::DarkGrey,
            Self::Red => Color::Red,
            Self::Green => Color::Green,
            Self::Yellow => Color::Yellow,
            Self::Blue => Color::Blue,
            Self::Magenta => Color::Magenta,
            Self::Cyan => Color::Cyan,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase", deny_unknown_fields)]
enum Draw {
    #[serde(rename = "ascii3d")]
    Ascii3D {
        scene: String,
        x: f64,
        y: f64,
        width: usize,
        height: usize,
    },
    Text {
        x: f64,
        y: f64,
        text: String,
        #[serde(default)]
        color: Ink,
    },
    Line {
        x: f64,
        y: f64,
        x2: f64,
        y2: f64,
        glyph: String,
        #[serde(default)]
        color: Ink,
    },
    Box {
        x: f64,
        y: f64,
        width: usize,
        height: usize,
        #[serde(default)]
        fill: bool,
        #[serde(default)]
        color: Ink,
    },
    Sprite {
        x: f64,
        y: f64,
        name: String,
        frame: Option<usize>,
        #[serde(default)]
        color: Ink,
    },
    Plot {
        x: f64,
        y: f64,
        width: usize,
        height: usize,
        values: Vec<f64>,
        min: f64,
        max: f64,
        #[serde(default)]
        color: Ink,
    },
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Cell {
    pub glyph: u8,
    pub color: Ink,
}
#[derive(Debug)]
pub struct Frame {
    pub width: usize,
    pub height: usize,
    pub cells: Vec<Cell>,
}
impl Frame {
    fn new(width: usize, height: usize) -> Self {
        Self {
            width,
            height,
            cells: vec![
                Cell {
                    glyph: b' ',
                    color: Ink::White
                };
                width * height
            ],
        }
    }
    fn put(&mut self, x: i32, y: i32, glyph: u8, color: Ink) {
        if x >= 0 && y >= 0 && x < self.width as i32 && y < self.height as i32 {
            self.cells[y as usize * self.width + x as usize] = Cell { glyph, color };
        }
    }
    fn line(&mut self, mut x: i32, mut y: i32, x2: i32, y2: i32, glyph: u8, color: Ink) {
        let dx = (x2 - x).abs();
        let sx = if x < x2 { 1 } else { -1 };
        let dy = -(y2 - y).abs();
        let sy = if y < y2 { 1 } else { -1 };
        let mut error = dx + dy;
        loop {
            self.put(x, y, glyph, color);
            if x == x2 && y == y2 {
                break;
            }
            let twice = 2 * error;
            if twice >= dy {
                error += dy;
                x += sx;
            }
            if twice <= dx {
                error += dx;
                y += sy;
            }
        }
    }
    pub fn plain(&self) -> String {
        self.cells
            .chunks(self.width)
            .map(|row| row.iter().map(|c| c.glyph as char).collect::<String>())
            .collect::<Vec<_>>()
            .join("\n")
    }
}

fn ascii(text: &str) -> Result<()> {
    ensure!(
        text.bytes().all(|b| (32..=126).contains(&b)),
        "Drawing text must contain printable ASCII only (no terminal escapes or newlines)"
    );
    Ok(())
}
fn coordinate(value: f64) -> Result<i32> {
    ensure!(
        value.is_finite() && (-4096.0..=4096.0).contains(&value),
        "Drawing coordinates must be finite and between -4096 and 4096"
    );
    Ok(value.floor() as i32)
}
fn dimensions(width: usize, height: usize) -> Result<()> {
    ensure!(
        (1..=240).contains(&width) && (1..=80).contains(&height),
        "Canvas and drawing sizes must be 1-240 columns by 1-80 rows"
    );
    Ok(())
}
fn value_json(value: &Value) -> Json {
    match value {
        Value::String(s) => serde_json::from_str(s).unwrap_or_else(|_| Json::String(s.clone())),
        _ => value.to_json(),
    }
}
fn text<'a>(section: &'a crate::rune_ast::Section, field: &str) -> Result<&'a str> {
    section
        .kv
        .get(field)
        .and_then(Value::as_str)
        .with_context(|| format!("Missing string field {field}"))
}
fn frame_rate(value: Json) -> Result<u64> {
    let rate = value
        .as_f64()
        .context("fps must be an integer from 1 to 60")?;
    ensure!(
        rate.fract() == 0.0 && (1.0..=60.0).contains(&rate),
        "fps must be an integer from 1 to 60"
    );
    Ok(rate as u64)
}

fn validate_steps(
    steps: &[ActionStep],
    logic: &LogicDefinition,
    tones: &HashMap<String, Tone>,
) -> Result<()> {
    let mutation = regex::Regex::new(r#"^[\w$.\[\]'"]+(?:\.push\s*\(|\s*(?:\+\+|--)$)"#)?;
    for step in steps {
        match step {
            ActionStep::Statement(source) => {
                let source = source.trim();
                if source.is_empty() || source.starts_with('#') {
                    continue;
                }
                if let Some(rest) = source.strip_prefix("sound ") {
                    let name: String = serde_json::from_str(rest)
                        .context("ASCII sound syntax is sound \"declared-tone-name\"")?;
                    ensure!(tones.contains_key(&name), "Unknown @AsciiTone/{name}");
                } else if let Some(rest) = source.strip_prefix("call ") {
                    let name = rest.split(['(', ' ', '\t']).next().unwrap_or("");
                    ensure!(
                        logic.actions.contains_key(name),
                        "Unknown ASCII action {name}"
                    );
                } else if let Some(eq) = crate::core::find_assignment_equals(source) {
                    let rhs = source[eq + 1..].trim();
                    let command = rhs.split_whitespace().next().unwrap_or("");
                    ensure!(
                        !matches!(
                            command,
                            "fetch" | "fetch-json" | "db" | "events" | "get-memory"
                        ),
                        "ASCII Animator does not support I/O: {source}"
                    );
                } else {
                    let command = source.split_whitespace().next().unwrap_or("");
                    ensure!(matches!(command, "stop" | "increment" | "decrement" | "invert" | "delete" | "push" | "swap")
                        || mutation.is_match(source), "Unsupported ASCII statement: {source}; use state assignments, mutations, or call");
                }
            }
            ActionStep::Conditional { steps, .. } | ActionStep::ForLoop { steps, .. } => {
                validate_steps(steps, logic, tones)?
            }
            ActionStep::Match { cases, .. } => {
                for case in cases {
                    validate_steps(&case.steps, logic, tones)?;
                }
            }
        }
    }
    Ok(())
}

pub(super) struct Sprite {
    frames: Vec<Vec<String>>,
    fps: u64,
}
impl Sprite {
    fn frame(&self, ticks: u64, fps: u64, index: Option<usize>) -> Result<&[String]> {
        let index = index.unwrap_or(
            ((ticks as u128 * self.fps as u128 / fps as u128) % self.frames.len() as u128) as usize,
        );
        Ok(self
            .frames
            .get(index)
            .context("ASCII sprite frame is out of range")?)
    }
}
pub struct Animation {
    pub width: usize,
    pub height: usize,
    pub fps: u64,
    pub keys: HashMap<String, String>,
    source: String,
    canvas: String,
    sprites: HashMap<String, Sprite>,
    scenes: HashMap<String, ascii3d::Scene>,
    tones: HashMap<String, Tone>,
    command: Option<String>,
}

pub fn compile(doc: &RuneDocument) -> Result<Animation> {
    let app = doc
        .get_section("App")
        .context("ASCII Animator needs @App")?;
    ensure!(
        text(app, "type")?.eq_ignore_ascii_case("ascii-animator"),
        "Expected @App type = ascii-animator"
    );
    let scene = text(app, "scene")?;
    let section = doc
        .sections
        .iter()
        .find(|s| s.path == ["AsciiAnimator", scene])
        .with_context(|| format!("Unknown @AsciiAnimator/{scene}"))?;
    for key in section.kv.keys() {
        ensure!(
            ["size", "fps", "logic", "canvas", "spatial", "command"].contains(&key.as_str()),
            "Unknown @AsciiAnimator field {key}"
        );
    }
    let size: Vec<usize> = serde_json::from_value(value_json(
        section
            .kv
            .get("size")
            .context("AsciiAnimator needs size = [width, height]")?,
    ))?;
    ensure!(size.len() == 2, "AsciiAnimator size needs two integers");
    dimensions(size[0], size[1])?;
    let fps = section
        .kv
        .get("fps")
        .map(value_json)
        .unwrap_or(Json::from(20));
    let fps = frame_rate(fps)?;
    let canvas = section
        .kv
        .get("canvas")
        .map(|_| text(section, "canvas"))
        .transpose()?
        .unwrap_or("canvas")
        .to_string();
    let logic_name = text(section, "logic")?;
    let logic_section = doc
        .sections
        .iter()
        .find(|s| s.path == ["Logic", logic_name])
        .with_context(|| format!("Unknown @Logic/{logic_name}"))?;
    let logic = parse_logic_section(logic_section).map_err(|e| anyhow!(e.to_string()))?;
    let command = section
        .kv
        .get("command")
        .map(|_| text(section, "command").map(str::to_owned))
        .transpose()?;
    if let Some(name) = &command {
        let action = logic
            .actions
            .get(name)
            .with_context(|| format!("Unknown ASCII command action {name}"))?;
        ensure!(
            action.params.len() == 1,
            "ASCII command action must accept exactly one text parameter"
        );
        ensure!(
            logic.keys.is_empty(),
            "ASCII command mode cannot also declare key bindings"
        );
    }
    let mut tones = HashMap::new();
    for section in doc
        .sections
        .iter()
        .filter(|s| s.path.first().map(String::as_str) == Some("AsciiTone"))
    {
        ensure!(section.path.len() == 2, "Expected @AsciiTone/<name>");
        let fields: serde_json::Map<String, Json> = section
            .kv
            .iter()
            .map(|(key, value)| (key.clone(), value_json(value)))
            .collect();
        let tone: Tone = serde_json::from_value(Json::Object(fields))
            .with_context(|| format!("Invalid @AsciiTone/{}", section.path[1]))?;
        tone.validate()?;
        ensure!(
            tones.insert(section.path[1].clone(), tone).is_none(),
            "Duplicate ASCII tone"
        );
        ensure!(tones.len() <= 64, "At most 64 ASCII tones may be declared");
    }
    for (name, action) in &logic.actions {
        validate_steps(&action.steps, &logic, &tones)
            .with_context(|| format!("Invalid ASCII action {name}"))?;
    }
    ensure!(
        logic.timer.is_none(),
        "ASCII Animator uses fps; remove the @Logic timer"
    );
    ensure!(
        logic.state.contains_key(&canvas),
        "Declare state field {canvas} for drawing commands"
    );
    for action in ["initialize", "tick"] {
        ensure!(
            logic.actions.contains_key(action),
            "ASCII Animator needs action {action}"
        );
    }
    for (key, action) in &logic.keys {
        ensure!(
            supported_key(key) && !matches!(key.as_str(), "KeyQ" | "Escape"),
            "Unsupported or reserved terminal key {key}"
        );
        ensure!(
            logic.actions.contains_key(action),
            "Unknown key action {action}"
        );
    }
    let keys = logic.keys.clone();
    let mut source = JsCodegen::new(
        ViewNode::Text(String::new()),
        logic,
        "{}".into(),
        None,
        HashMap::new(),
        None,
        None,
        None,
        HashMap::new(),
        HashMap::new(),
    )
    .generate_logic_test();
    let mut sprites = HashMap::new();
    for section in doc
        .sections
        .iter()
        .filter(|s| s.path.first().map(String::as_str) == Some("AsciiSprite"))
    {
        ensure!(section.path.len() == 2, "Expected @AsciiSprite/<name>");
        for key in section.kv.keys() {
            ensure!(
                ["fps", "frames"].contains(&key.as_str()),
                "Unknown @AsciiSprite field {key}"
            );
        }
        let frames: Vec<Vec<String>> = serde_json::from_value(value_json(
            section
                .kv
                .get("frames")
                .context("AsciiSprite needs frames = [[rows...], ...]")?,
        ))?;
        ensure!(
            !frames.is_empty() && frames.len() <= 120,
            "AsciiSprite needs 1-120 frames"
        );
        for rows in &frames {
            ensure!(
                !rows.is_empty() && rows.len() <= 80,
                "Sprite needs 1-80 rows"
            );
            for row in rows {
                ascii(row)?;
                ensure!(row.len() <= 240, "Sprite rows cannot exceed 240 columns");
            }
        }
        let rate = section
            .kv
            .get("fps")
            .map(value_json)
            .unwrap_or(Json::from(8));
        let rate = frame_rate(rate)?;
        ensure!(
            sprites
                .insert(section.path[1].clone(), Sprite { frames, fps: rate })
                .is_none(),
            "Duplicate ASCII sprite"
        );
    }
    let scenes = ascii3d::compile(doc, &sprites)?;
    if let Some(spatial) = section.kv.get("spatial") {
        let name = spatial
            .as_str()
            .context("AsciiAnimator spatial must name an Ascii3D scene")?;
        let scene = scenes
            .get(name)
            .with_context(|| format!("Unknown spatial @Ascii3D/{name}"))?;
        source.push_str(&format!(
            "\nglobalThis.__RuneSpatialMap = {};\n",
            scene.spatial()?
        ));
    }
    Ok(Animation {
        width: size[0],
        height: size[1],
        fps,
        keys,
        source,
        canvas,
        sprites,
        tones,
        command,
        scenes,
    })
}

fn supported_key(key: &str) -> bool {
    matches!(
        key,
        "ArrowLeft"
            | "ArrowRight"
            | "ArrowUp"
            | "ArrowDown"
            | "Space"
            | "Enter"
            | "Tab"
            | "Backspace"
    ) || (key.len() == 4 && key.starts_with("Key") && key.as_bytes()[3].is_ascii_uppercase())
        || (key.len() == 6 && key.starts_with("Digit") && key.as_bytes()[5].is_ascii_digit())
}

pub struct Engine {
    animation: Animation,
    context: Context,
    _runtime: Runtime,
    deadline: Arc<Mutex<Instant>>,
    ticks: u64,
    audio: Bridge,
}
impl Engine {
    pub fn new(animation: Animation) -> Result<Self> {
        Self::with_audio(animation, Bridge::silent())
    }
    pub fn with_audio(animation: Animation, audio: Bridge) -> Result<Self> {
        let runtime = Runtime::new()?;
        runtime.set_memory_limit(64 * 1024 * 1024);
        runtime.set_max_stack_size(512 * 1024);
        let deadline = Arc::new(Mutex::new(Instant::now() + Duration::from_secs(2)));
        let clock = deadline.clone();
        runtime.set_interrupt_handler(Some(Box::new(move || {
            Instant::now() > *clock.lock().unwrap()
        })));
        let context = Context::full(&runtime)?;
        let engine = Self {
            animation,
            context,
            _runtime: runtime,
            deadline,
            ticks: 0,
            audio,
        };
        engine.eval::<()>(&engine.animation.source)?;
        engine.eval::<()>("console.warn = console.error = function(message) { throw new Error(String(message)); };")?;
        engine.invoke("initialize")?;
        engine.frame()?;
        Ok(engine)
    }
    fn eval<T>(&self, source: &str) -> Result<T>
    where
        for<'js> T: rquickjs::FromJs<'js>,
    {
        *self.deadline.lock().unwrap() = Instant::now() + Duration::from_millis(250);
        self.context.with(|ctx| {
            ctx.eval(source)
                .map_err(|e| anyhow!(CaughtError::from_error(&ctx, e).to_string()))
        })
    }
    pub fn invoke(&self, action: &str) -> Result<()> {
        self.invoke_args(action, &[])
    }
    fn invoke_args(&self, action: &str, args: &[Json]) -> Result<()> {
        self.eval::<()>(&format!(
            "__RuneWeb.invoke({}, {})",
            serde_json::to_string(action)?,
            serde_json::to_string(args)?
        ))?;
        let audio: String = self.eval("__RuneWeb.takeAudio()")?;
        let events: Vec<Json> = serde_json::from_str(&audio)?;
        ensure!(
            events.len() <= 32,
            "An ASCII action may emit at most 32 tones"
        );
        for event in events {
            ensure!(
                event["operation"] == "sound.play",
                "Unsupported ASCII audio operation"
            );
            let args = event["args"]
                .as_array()
                .context("Invalid ASCII sound arguments")?;
            ensure!(
                args.len() == 2 && args[1].is_null(),
                "ASCII sound accepts only a tone name"
            );
            let name = args[0].as_str().context("ASCII sound needs a tone name")?;
            let tone = self
                .animation
                .tones
                .get(name)
                .with_context(|| format!("Unknown @AsciiTone/{name}"))?;
            self.audio.tone(tone)?;
        }
        Ok(())
    }
    pub fn command(&self, input: &str) -> Result<()> {
        let action = self
            .animation
            .command
            .as_deref()
            .context("This ASCII app does not declare a command action")?;
        ascii(input)?;
        ensure!(
            input.len() <= 120,
            "ASCII commands cannot exceed 120 characters"
        );
        let input = input
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .to_ascii_lowercase();
        if !input.is_empty() {
            self.invoke_args(action, &[Json::String(input)])?;
        }
        Ok(())
    }
    pub fn key(&self, key: &str) -> Result<()> {
        ensure!(supported_key(key), "Unsupported terminal key {key}");
        if let Some(action) = self.animation.keys.get(key) {
            self.invoke(action)?;
        }
        Ok(())
    }
    pub fn step(&mut self) -> Result<Frame> {
        self.invoke("tick")?;
        self.ticks += 1;
        self.frame()
    }
    pub fn snapshot(&self) -> Result<Json> {
        let snapshot: String = self.eval("__RuneWeb.snapshot()")?;
        Ok(serde_json::from_str(&snapshot)?)
    }
    pub fn frame(&self) -> Result<Frame> {
        let snapshot = self.snapshot()?;
        let mock = &snapshot["mock"];
        ensure!(
            ["audio", "downloads", "clipboard"]
                .iter()
                .all(|k| mock[*k].as_array().is_some_and(Vec::is_empty))
                && mock["storage"].as_object().is_some_and(|s| s.is_empty()),
            "ASCII Animator does not support browser audio, storage, clipboard, or downloads"
        );
        let commands: Vec<Draw> =
            serde_json::from_value(snapshot["state"][&self.animation.canvas].clone())
                .context("Invalid ASCII canvas drawing commands")?;
        ensure!(
            commands.len() <= 1024,
            "Canvas cannot exceed 1024 drawing commands"
        );
        let mut frame = Frame::new(self.animation.width, self.animation.height);
        let mut views = 0;
        for command in commands {
            match command {
                Draw::Ascii3D {
                    scene,
                    x,
                    y,
                    width,
                    height,
                } => {
                    views += 1;
                    ensure!(views <= 4, "Canvas cannot exceed four Ascii3D views");
                    dimensions(width, height)?;
                    let scene = self
                        .animation
                        .scenes
                        .get(&scene)
                        .with_context(|| format!("Unknown @Ascii3D/{scene}"))?;
                    scene.render(
                        &mut frame,
                        &snapshot["state"],
                        &self.animation.sprites,
                        self.ticks,
                        self.animation.fps,
                        coordinate(x)?,
                        coordinate(y)?,
                        width,
                        height,
                    )?;
                }
                Draw::Text { x, y, text, color } => {
                    ascii(&text)?;
                    ensure!(text.len() <= 4096, "Text cannot exceed 4096 characters");
                    let (x, y) = (coordinate(x)?, coordinate(y)?);
                    for (offset, glyph) in text.bytes().enumerate() {
                        frame.put(x + offset as i32, y, glyph, color);
                    }
                }
                Draw::Line {
                    x,
                    y,
                    x2,
                    y2,
                    glyph,
                    color,
                } => {
                    ascii(&glyph)?;
                    ensure!(
                        glyph.len() == 1,
                        "Line glyph must be one printable ASCII character"
                    );
                    frame.line(
                        coordinate(x)?,
                        coordinate(y)?,
                        coordinate(x2)?,
                        coordinate(y2)?,
                        glyph.as_bytes()[0],
                        color,
                    );
                }
                Draw::Box {
                    x,
                    y,
                    width,
                    height,
                    fill,
                    color,
                } => {
                    dimensions(width, height)?;
                    let (x, y) = (coordinate(x)?, coordinate(y)?);
                    for row in 0..height as i32 {
                        for col in 0..width as i32 {
                            let edge_x = col == 0 || col == width as i32 - 1;
                            let edge_y = row == 0 || row == height as i32 - 1;
                            let glyph = if edge_x && edge_y {
                                b'+'
                            } else if edge_y {
                                b'-'
                            } else if edge_x {
                                b'|'
                            } else {
                                b' '
                            };
                            if fill || edge_x || edge_y {
                                frame.put(x + col, y + row, glyph, color);
                            }
                        }
                    }
                }
                Draw::Sprite {
                    x,
                    y,
                    name,
                    frame: index,
                    color,
                } => {
                    let sprite = self
                        .animation
                        .sprites
                        .get(&name)
                        .with_context(|| format!("Unknown ASCII sprite {name}"))?;
                    let rows = sprite.frame(self.ticks, self.animation.fps, index)?;
                    let (x, y) = (coordinate(x)?, coordinate(y)?);
                    for (row, text) in rows.iter().enumerate() {
                        for (col, glyph) in text.bytes().enumerate() {
                            if glyph != b' ' {
                                frame.put(x + col as i32, y + row as i32, glyph, color);
                            }
                        }
                    }
                }
                Draw::Plot {
                    x,
                    y,
                    width,
                    height,
                    values,
                    min,
                    max,
                    color,
                } => {
                    dimensions(width, height)?;
                    ensure!(
                        min.is_finite() && max.is_finite() && max > min && (max - min).is_finite(),
                        "Plot max must be greater than min and its range finite"
                    );
                    ensure!(
                        values.len() <= 4096 && values.iter().all(|v| v.is_finite()),
                        "Plot needs at most 4096 finite values"
                    );
                    let (x, y) = (coordinate(x)?, coordinate(y)?);
                    let samples = &values[values.len().saturating_sub(width)..];
                    let mut previous = None;
                    for (i, value) in samples.iter().enumerate() {
                        let col = if samples.len() > 1 {
                            i * (width - 1) / (samples.len() - 1)
                        } else {
                            0
                        };
                        let level = ((value.clamp(min, max) - min) / (max - min)
                            * (height - 1) as f64)
                            .round() as i32;
                        let point = (x + col as i32, y + height as i32 - 1 - level);
                        if let Some((px, py)) = previous {
                            frame.line(px, py, point.0, point.1, b'*', color);
                        } else {
                            frame.put(point.0, point.1, b'*', color);
                        }
                        previous = Some(point);
                    }
                }
            }
        }
        Ok(frame)
    }
}

struct Terminal {
    active: bool,
}
impl Terminal {
    fn open() -> Result<Self> {
        terminal::enable_raw_mode()?;
        let mut guard = Self { active: true };
        if let Err(error) = execute!(io::stdout(), EnterAlternateScreen, Hide) {
            guard.close()?;
            return Err(error.into());
        }
        Ok(guard)
    }
    fn close(&mut self) -> Result<()> {
        if !self.active {
            return Ok(());
        }
        // Attempt both operations even if one fails.
        let screen = execute!(io::stdout(), ResetColor, Show, LeaveAlternateScreen);
        let raw = terminal::disable_raw_mode();
        if screen.is_ok() && raw.is_ok() {
            self.active = false;
        }
        screen?;
        raw?;
        Ok(())
    }
}
impl Drop for Terminal {
    fn drop(&mut self) {
        if let Err(error) = self.close() {
            eprintln!("Could not restore terminal: {error}");
        }
    }
}

pub fn run(
    animation: Animation,
    frames: Option<u64>,
    plain: bool,
    keys: &[String],
    mute: bool,
    commands: &[String],
) -> Result<()> {
    ensure!(frames.is_none_or(|n| n > 0), "Frame count must be positive");
    ensure!(plain || keys.is_empty(), "--keys requires --plain");
    ensure!(plain || commands.is_empty(), "--commands requires --plain");
    ensure!(
        keys.is_empty() || commands.is_empty(),
        "--keys and --commands cannot be combined"
    );
    for key in keys {
        ensure!(supported_key(key), "Unsupported terminal key {key}");
    }
    let count = frames.unwrap_or(1);
    ensure!(
        !plain || keys.len() as u64 <= count,
        "There cannot be more keys than frames"
    );
    ensure!(
        !plain || commands.len() as u64 <= count,
        "There cannot be more commands than frames"
    );
    ensure!(
        commands.is_empty() || animation.command.is_some(),
        "--commands requires an AsciiAnimator command action"
    );
    ensure!(
        keys.is_empty() || animation.command.is_none(),
        "Command-mode apps use --commands, not --keys"
    );
    for command in commands {
        ascii(command)?;
        ensure!(
            command.len() <= 120,
            "ASCII commands cannot exceed 120 characters"
        );
    }
    if !plain {
        ensure!(io::stdin().is_terminal() && io::stdout().is_terminal(), "ASCII Animator needs an interactive terminal; use ascii run <file> --plain --frames N for redirected output");
    }
    let audible = !plain && !mute && !animation.tones.is_empty();
    let output = if audible {
        Output::open().context("Could not open ASCII sound output; rerun with --mute")?
    } else {
        Output::silent()
    };
    let mut engine = if audible {
        Engine::with_audio(animation, output.bridge.clone())?
    } else {
        Engine::new(animation)?
    };
    if plain {
        let mut frame = engine.frame()?;
        for i in 0..count {
            if let Some(key) = keys.get(i as usize) {
                engine.key(key)?;
            }
            if let Some(command) = commands.get(i as usize) {
                engine.command(command)?;
            }
            frame = engine.step()?;
        }
        writeln!(io::stdout(), "{}", frame.plain())?;
        return Ok(());
    }
    let mut terminal = Terminal::open()?;
    let mut input = String::new();
    let command_mode = engine.animation.command.is_some();
    let result = (|| -> Result<()> {
        let duration = Duration::from_secs_f64(1.0 / engine.animation.fps as f64);
        let mut next = Instant::now();
        let mut rendered = 0;
        loop {
            let now = Instant::now();
            if now >= next {
                let (cols, rows) = terminal::size()?;
                let mut out = io::stdout().lock();
                if (cols as usize) < engine.animation.width
                    || (rows as usize) <= engine.animation.height
                {
                    queue!(out, MoveTo(0, 0), Clear(ClearType::All), ResetColor)?;
                    let message = format!(
                        "Resize to {}x{}; Esc exits",
                        engine.animation.width,
                        engine.animation.height + 1
                    );
                    write!(
                        out,
                        "{}",
                        &message[..message.len().min(cols.saturating_sub(1) as usize)]
                    )?;
                } else {
                    let frame = engine.step()?;
                    let mut ink = None;
                    for (y, row) in frame.cells.chunks(frame.width).enumerate() {
                        queue!(out, MoveTo(0, y as u16))?;
                        for cell in row {
                            if ink != Some(cell.color) {
                                queue!(out, SetForegroundColor(cell.color.terminal()))?;
                                ink = Some(cell.color);
                            }
                            write!(out, "{}", cell.glyph as char)?;
                        }
                    }
                    prompt(
                        &mut out,
                        engine.animation.height,
                        cols,
                        command_mode,
                        &input,
                    )?;
                    rendered += 1;
                }
                out.flush()?;
                if frames.is_some_and(|limit| rendered >= limit) {
                    break;
                }
                next = Instant::now() + duration;
            }
            if event::poll(next.saturating_duration_since(Instant::now()))? {
                match event::read()? {
                    Event::Key(key) if key.kind != KeyEventKind::Release => {
                        if key.code == KeyCode::Esc
                            || (!command_mode
                                && matches!(key.code, KeyCode::Char('q') | KeyCode::Char('Q')))
                            || (key.modifiers.contains(KeyModifiers::CONTROL)
                                && key.code == KeyCode::Char('c'))
                        {
                            break;
                        }
                        if command_mode {
                            match key.code {
                                KeyCode::Enter => {
                                    engine.command(&input)?;
                                    input.clear();
                                }
                                KeyCode::Backspace => {
                                    input.pop();
                                }
                                KeyCode::Char('u')
                                    if key.modifiers.contains(KeyModifiers::CONTROL) =>
                                {
                                    input.clear()
                                }
                                KeyCode::Char(c)
                                    if !key
                                        .modifiers
                                        .intersects(KeyModifiers::CONTROL | KeyModifiers::ALT)
                                        && c.is_ascii()
                                        && (32..=126).contains(&(c as u8))
                                        && input.len() < 120 =>
                                {
                                    input.push(c)
                                }
                                _ => {}
                            }
                            let (cols, rows) = terminal::size()?;
                            if rows as usize > engine.animation.height {
                                let mut out = io::stdout().lock();
                                prompt(&mut out, engine.animation.height, cols, true, &input)?;
                                out.flush()?;
                            }
                            continue;
                        }
                        let name = match key.code {
                            KeyCode::Left => Some("ArrowLeft".into()),
                            KeyCode::Right => Some("ArrowRight".into()),
                            KeyCode::Up => Some("ArrowUp".into()),
                            KeyCode::Down => Some("ArrowDown".into()),
                            KeyCode::Enter => Some("Enter".into()),
                            KeyCode::Tab => Some("Tab".into()),
                            KeyCode::Backspace => Some("Backspace".into()),
                            KeyCode::Char(' ') => Some("Space".into()),
                            KeyCode::Char(c) if c.is_ascii_alphabetic() => {
                                Some(format!("Key{}", c.to_ascii_uppercase()))
                            }
                            KeyCode::Char(c) if c.is_ascii_digit() => Some(format!("Digit{c}")),
                            _ => None,
                        };
                        if let Some(name) = name {
                            engine.key(&name)?;
                        }
                    }
                    Event::Resize(_, _) => {
                        execute!(io::stdout(), Clear(ClearType::All))?;
                    }
                    _ => {}
                }
            }
        }
        Ok(())
    })();
    let cleanup = terminal.close();
    result?;
    cleanup
}

fn prompt(
    out: &mut impl Write,
    height: usize,
    cols: u16,
    command_mode: bool,
    input: &str,
) -> Result<()> {
    queue!(
        out,
        MoveTo(0, height as u16),
        ResetColor,
        Clear(ClearType::CurrentLine)
    )?;
    let footer = if command_mode {
        format!("ASCII Animator | Esc: exit | > {input}_")
    } else {
        "ASCII Animator | Q / Esc / Ctrl-C: exit".to_owned()
    };
    let width = cols.saturating_sub(1) as usize;
    let start = if command_mode {
        footer.len().saturating_sub(width)
    } else {
        0
    };
    write!(out, "{}", &footer[start..(start + width).min(footer.len())])?;
    Ok(())
}
