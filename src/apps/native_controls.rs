//! Desktop devices normalized to the browser-standard button/axis numbering.
use gilrs::{Axis, Button, EventType, Gilrs, GilrsBuilder};
use serde_json::{json, Value};
use winit::event::{MouseButton, MouseScrollDelta};

const BUTTONS: [Button; 17] = [
    Button::South,
    Button::East,
    Button::West,
    Button::North,
    Button::LeftTrigger,
    Button::RightTrigger,
    Button::LeftTrigger2,
    Button::RightTrigger2,
    Button::Select,
    Button::Start,
    Button::LeftThumb,
    Button::RightThumb,
    Button::DPadUp,
    Button::DPadDown,
    Button::DPadLeft,
    Button::DPadRight,
    Button::Mode,
];

pub fn mouse_button(button: MouseButton) -> Option<&'static str> {
    match button {
        MouseButton::Left => Some("Left"),
        MouseButton::Middle => Some("Middle"),
        MouseButton::Right => Some("Right"),
        MouseButton::Back => Some("Back"),
        MouseButton::Forward => Some("Forward"),
        _ => None,
    }
}
pub fn wheel(delta: MouseScrollDelta) -> (f64, f64) {
    match delta {
        MouseScrollDelta::LineDelta(x, y) => (-f64::from(x) * 16., -f64::from(y) * 16.),
        MouseScrollDelta::PixelDelta(p) => (-p.x, -p.y),
    }
}
#[derive(Default)]
pub struct Gamepads {
    backend: Option<Gilrs>,
}
impl Gamepads {
    pub fn new(enabled: bool) -> Self {
        // The shared controller owns deadzones. Dpad axis fallback is normalized below.
        Self {
            backend: if enabled {
                GilrsBuilder::new().with_default_filters(false).build().ok()
            } else {
                None
            },
        }
    }
    pub fn poll(&mut self, focused: bool) -> (Vec<Value>, Value) {
        let Some(gilrs) = &mut self.backend else {
            return (vec![], json!([]));
        };
        let mut events = vec![];
        while let Some(event) = gilrs.next_event() {
            if !focused {
                continue;
            }
            let button = match event.event {
                EventType::ButtonPressed(b, _) => Some((b, 1.)),
                EventType::ButtonReleased(b, _) => Some((b, 0.)),
                EventType::ButtonChanged(b, v, _) => Some((b, v)),
                _ => None,
            };
            if let Some((button, value)) = button {
                if let Some(index) = BUTTONS.iter().position(|&b| b == button) {
                    let id = usize::from(event.id);
                    events.push(json!({"device":"gamepad","code":format!("Button{index}"),"source":format!("pad:{id}:Button{index}"),"value":value}));
                }
            }
        }
        if !focused {
            return (events, json!([]));
        }
        let pads: Vec<Value> = gilrs.gamepads().map(|(id, pad)| {
            let buttons: Vec<Value> = BUTTONS.iter().map(|&b| {
                let fallback = match b { Button::DPadUp => pad.value(Axis::DPadY).max(0.), Button::DPadDown => (-pad.value(Axis::DPadY)).max(0.), Button::DPadLeft => (-pad.value(Axis::DPadX)).max(0.), Button::DPadRight => pad.value(Axis::DPadX).max(0.), _ => 0. };
                json!({"value":pad.button_data(b).map(|b| b.value()).unwrap_or(fallback)})
            }).collect();
            // gilrs uses positive-up sticks; Web Gamepad uses positive-down.
            json!({"index":usize::from(id), "axes":[pad.value(Axis::LeftStickX), -pad.value(Axis::LeftStickY), pad.value(Axis::RightStickX), -pad.value(Axis::RightStickY)], "buttons":buttons})
        }).collect();
        (events, json!(pads))
    }
}
