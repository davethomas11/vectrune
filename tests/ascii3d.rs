use rune_runtime::{
    apps::ascii_animator::{compile, Engine, Frame, Ink},
    rune_parser::parse_rune,
};
use serde_json::{json, Value};

fn source(map: &[&str], camera: Value, entities: Value, extra: &str) -> String {
    format!(
        r##"@App
type = ascii-animator
scene = test
@AsciiAnimator/test
size = [60, 22]
fps = 20
logic = test
@Ascii3D/world
map = {}
walls = {{"#": {{"texture": "wall", "color": "cyan"}}}}
camera = camera
entities = things
{}
@AsciiSprite/wall
frames = [["#=#=", "|.|."]]
@AsciiSprite/target
fps = 20
frames = [["RRR", "RRR", "RRR"], ["OOO", "OOO", "OOO"]]
@Logic/test
state:
    camera = {}
    things = {}
    canvas = []
action initialize:
    call paint
action tick:
    call paint
action paint:
    canvas = [
        {{"type": "ascii3d", "scene": "world", "x": 2, "y": 1, "width": 56, "height": 20}},
        {{"type": "text", "x": 29, "y": 11, "text": "+", "color": "yellow"}}
    ]
"##,
        json!(map),
        extra,
        camera,
        entities
    )
}
const ROOM: &[&str] = &[
    "#########",
    "#.......#",
    "#.......#",
    "#.......#",
    "#.......#",
    "#.......#",
    "#########",
];
fn camera() -> Value {
    json!({"x": 2.5, "y": 3.5, "angle": 0})
}
fn target(x: f64, color: &str) -> Value {
    json!({"x":x,"y":3.5,"sprite":"target","size":0.8,"color":color})
}
fn engine(source: &str) -> Engine {
    Engine::new(compile(&parse_rune(source).unwrap()).unwrap()).unwrap()
}
fn render(source: &str) -> Frame {
    engine(source).frame().unwrap()
}
fn color_count(frame: &Frame, ink: Ink) -> usize {
    frame
        .cells
        .iter()
        .filter(|c| c.color == ink && c.glyph != b' ')
        .count()
}
fn demo(name: &str) -> String {
    std::fs::read_to_string(format!("examples/ascii/{name}.rune")).unwrap()
}

#[test]
fn raycast_walls_floor_textures_viewport_and_hud_are_real_cells() {
    let frame = render(&source(ROOM, camera(), json!([]), ""));
    assert_eq!(frame.width, 60);
    assert_eq!(frame.height, 22);
    assert!(color_count(&frame, Ink::Cyan) > 80);
    assert!(frame
        .cells
        .iter()
        .any(|c| c.glyph == b'=' && c.color == Ink::Cyan));
    assert!(frame
        .cells
        .iter()
        .any(|c| c.glyph == b',' && c.color == Ink::Gray));
    assert_eq!(frame.cells[11 * 60 + 29].glyph, b'+');
    assert_eq!(frame.cells[11 * 60 + 29].color, Ink::Yellow);
    for row in frame.cells.chunks(60) {
        assert_eq!(row[0].glyph, b' ');
        assert_eq!(row[59].glyph, b' ');
    }
    let changed = render(&source(
        ROOM,
        json!({"x":2.5,"y":3.5,"angle":35,"pitch":-10}),
        json!([]),
        "",
    ));
    assert_ne!(frame.plain(), changed.plain());
}

#[test]
fn sprites_scale_with_distance_animate_and_obey_wall_and_entity_depth() {
    let near = source(ROOM, camera(), json!([target(4.5, "red")]), "");
    let distant = source(ROOM, camera(), json!([target(6.5, "red")]), "");
    let count = color_count(&render(&near), Ink::Red);
    assert!(count > 20);
    assert!(color_count(&render(&distant), Ink::Red) < count / 2);
    for entities in [
        json!([target(4.5, "red"), target(6.5, "green")]),
        json!([target(6.5, "green"), target(4.5, "red")]),
    ] {
        let frame = render(&source(ROOM, camera(), entities, ""));
        assert_eq!(color_count(&frame, Ink::Red), count);
        assert_eq!(color_count(&frame, Ink::Green), 0);
    }
    let divider = &[
        "#########",
        "#...#...#",
        "#...#...#",
        "#...#...#",
        "#...#...#",
        "#...#...#",
        "#########",
    ];
    assert_eq!(
        color_count(
            &render(&source(divider, camera(), json!([target(6.5, "red")]), "")),
            Ink::Red
        ),
        0
    );
    assert_eq!(
        color_count(
            &render(&source(ROOM, camera(), json!([target(1.0, "red")]), "")),
            Ink::Red
        ),
        0
    );
    let mut game = engine(&near);
    assert!(game
        .frame()
        .unwrap()
        .cells
        .iter()
        .any(|c| c.color == Ink::Red && c.glyph == b'R'));
    assert!(game
        .step()
        .unwrap()
        .cells
        .iter()
        .any(|c| c.color == Ink::Red && c.glyph == b'O'));
}

#[test]
fn transparent_sprites_and_clipped_views_preserve_layering() {
    let solid = source(ROOM, camera(), json!([target(4.5, "red")]), "");
    let transparent = solid.replace(
        "[[\"RRR\", \"RRR\", \"RRR\"], [\"OOO\", \"OOO\", \"OOO\"]]",
        "[[\"R R\", \"R R\", \"R R\"]]",
    );
    assert!(color_count(&render(&transparent), Ink::Red) < color_count(&render(&solid), Ink::Red));
    let clipped = solid.replace(
        "\"x\": 2, \"y\": 1, \"width\": 56",
        "\"x\": -10, \"y\": -2, \"width\": 56",
    );
    let frame = render(&clipped);
    assert_eq!(frame.cells.len(), 60 * 22);
    assert!(color_count(&frame, Ink::Cyan) > 0);
}

#[test]
fn repeating_halls_are_seamless_and_can_run_indefinitely() {
    let map = &["#.......#", "#.......#", "#.......#", "#.......#"];
    let first = render(&source(
        map,
        json!({"x":4.5,"y":0.5,"angle":90}),
        json!([]),
        "repeat_y = true",
    ));
    let later = render(&source(
        map,
        json!({"x":4.5,"y":4.5,"angle":90}),
        json!([]),
        "repeat_y = true",
    ));
    assert_eq!(first.plain(), later.plain());
    let mut halls = engine(&demo("halls"));
    for _ in 0..600 {
        halls.step().unwrap();
    }
    let state = halls.snapshot().unwrap()["state"].clone();
    assert_eq!(state["ticks"], 600);
    assert!(state["camera"]["y"].as_f64().unwrap() < 16.0);
    halls.key("Space").unwrap();
    let before = halls.snapshot().unwrap()["state"]["camera"].clone();
    for _ in 0..10 {
        halls.step().unwrap();
    }
    assert_eq!(halls.snapshot().unwrap()["state"]["camera"], before);
}

#[test]
fn invalid_configuration_camera_entities_and_scene_fail_explicitly() {
    let valid = source(ROOM, camera(), json!([target(4.5, "red")]), "");
    for (from, to) in [
        ("entities = things", "entities = things\nfov = 0"),
        ("entities = things", "entities = things\nfar = 10000"),
        ("entities = things", "entities = things\ncell_aspect = 0"),
        ("entities = things", "entities = things\nunknown = true"),
        ("entities = things", "entities = things\nrepeat_y = \"yes\""),
        ("\"#.......#\"", "\"#......#\""),
        ("\"#.......#\"", "\"#...?...#\""),
        ("texture\": \"wall\"", "texture\": \"missing\""),
        ("\"#=#=\", \"|.|.\"", "\"#=#=\", \"|.|\""),
        ("\"#########\"", "\"#.......#\""),
        ("logic = test", "logic = test\nspatial = missing"),
    ] {
        assert!(
            compile(&parse_rune(&valid.replacen(from, to, 1)).unwrap()).is_err(),
            "{to}"
        );
    }
    for camera in [
        json!({"x":0.5,"y":0.5,"angle":0}),
        json!({"x":-1.0,"y":3.5,"angle":0}),
        json!({"x":2.5,"y":3.5,"angle":0,"pitch":46}),
        json!({"x":2.5,"y":3.5,"angle":0,"z":0}),
        json!({"x":2.5,"y":3.5,"angle":0,"unknown":true}),
    ] {
        assert!(Engine::new(
            compile(&parse_rune(&source(ROOM, camera, json!([]), "")).unwrap()).unwrap()
        )
        .is_err());
    }
    for entities in [
        json!([{"x":4.5,"y":3.5,"sprite":"missing"}]),
        json!([{"x":4.5,"y":3.5,"sprite":"target","frame":999}]),
        json!([{"x":4.5,"y":3.5,"sprite":"target","size":-1}]),
        json!([{"x":4.5,"y":3.5,"sprite":"target","z":-1}]),
        json!([{"x":4.5,"y":3.5,"sprite":"target","unknown":true}]),
        Value::Array(vec![target(4.5, "red"); 257]),
    ] {
        assert!(Engine::new(
            compile(&parse_rune(&source(ROOM, camera(), entities, "")).unwrap()).unwrap()
        )
        .is_err());
    }
    assert!(Engine::new(
        compile(
            &parse_rune(&valid.replace("\"scene\": \"world\"", "\"scene\": \"missing\"")).unwrap()
        )
        .unwrap()
    )
    .is_err());
}

#[test]
fn sentinel_shots_movement_ai_pause_loss_and_restart_use_shared_logic() {
    let mut game = engine(&demo("sentinel"));
    game.key("Enter").unwrap();
    game.key("Space").unwrap();
    assert_eq!(game.snapshot().unwrap()["state"]["drones"][0]["health"], 1);
    game.key("Space").unwrap(); // Cooldown cannot damage twice in the same tick.
    assert_eq!(game.snapshot().unwrap()["state"]["drones"][0]["health"], 1);
    for _ in 0..3 {
        game.step().unwrap();
    }
    game.key("Space").unwrap();
    assert_eq!(game.snapshot().unwrap()["state"]["kills"], 1);
    assert_eq!(
        game.snapshot().unwrap()["state"]["drones"][0]["visible"],
        false
    );
    game.key("KeyW").unwrap();
    assert!(
        game.snapshot().unwrap()["state"]["camera"]["x"]
            .as_f64()
            .unwrap()
            > 3.5
    );
    for _ in 0..80 {
        game.key("KeyW").unwrap();
    }
    assert!(
        game.snapshot().unwrap()["state"]["camera"]["x"]
            .as_f64()
            .unwrap()
            < 15.0
    );
    game.key("KeyP").unwrap();
    game.step().unwrap();
    let before = game.snapshot().unwrap()["state"].clone();
    for _ in 0..5 {
        game.step().unwrap();
        game.key("KeyW").unwrap();
    }
    assert_eq!(game.snapshot().unwrap()["state"], before);
    game.key("KeyR").unwrap();
    assert_eq!(game.snapshot().unwrap()["state"]["kills"], 0);
    assert_eq!(game.snapshot().unwrap()["state"]["health"], 100);
    let drone_before = game.snapshot().unwrap()["state"]["drones"][0]["x"].clone();
    for _ in 0..10 {
        game.step().unwrap();
    }
    assert!(
        game.snapshot().unwrap()["state"]["drones"][0]["x"]
            .as_f64()
            .unwrap()
            < drone_before.as_f64().unwrap()
    );
    for _ in 0..550 {
        game.step().unwrap();
    }
    assert_eq!(game.snapshot().unwrap()["state"]["status"], "gameover");
}

#[test]
fn descent_is_on_rails_with_downhill_progress_firing_damage_pause_and_restart() {
    let mut game = engine(&demo("descent"));
    game.key("Enter").unwrap();
    game.step().unwrap();
    let before = game.snapshot().unwrap()["state"].clone();
    assert!(before["camera"]["y"].as_f64().unwrap() > 0.5);
    assert!(before["camera"]["pitch"].as_f64().unwrap() < 0.0);
    assert!(before["altitude"].as_f64().unwrap() < 1200.0);
    game.key("Space").unwrap();
    assert_eq!(game.snapshot().unwrap()["state"]["score"], 100);
    for _ in 0..4 {
        game.step().unwrap();
    }
    assert_eq!(game.snapshot().unwrap()["state"]["targets"], json!([]));
    game.key("KeyA").unwrap();
    assert!(
        game.snapshot().unwrap()["state"]["camera"]["x"]
            .as_f64()
            .unwrap()
            < 5.5
    );
    game.key("KeyP").unwrap();
    game.step().unwrap();
    let before = game.snapshot().unwrap()["state"].clone();
    for _ in 0..5 {
        game.step().unwrap();
        game.key("KeyD").unwrap();
    }
    assert_eq!(game.snapshot().unwrap()["state"], before);
    game.key("KeyR").unwrap();
    for _ in 0..500 {
        game.step().unwrap();
    }
    let state = game.snapshot().unwrap()["state"].clone();
    assert_eq!(state["status"], "gameover");
    assert_eq!(state["shield"], 0);
    assert!(state["meters"].as_f64().unwrap() > 0.0);
    assert!(state["camera"]["y"].as_f64().unwrap() < 16.0);
    game.key("KeyR").unwrap();
    assert_eq!(game.snapshot().unwrap()["state"]["shield"], 100);
    assert_eq!(game.snapshot().unwrap()["state"]["meters"], 0);
}

#[test]
fn sentinel_walls_block_shots_and_all_six_kills_win() {
    let blocked = demo("sentinel")
        .replace("\"y\": 3.5, \"angle\": 0", "\"y\": 4.5, \"angle\": 0")
        .replace(
            "\"id\": 1, \"x\": 7.5, \"y\": 3.5",
            "\"id\": 1, \"x\": 7.5, \"y\": 4.5",
        );
    let mut game = engine(&blocked);
    game.key("Enter").unwrap();
    game.key("Space").unwrap();
    assert_eq!(game.snapshot().unwrap()["state"]["drones"][0]["health"], 2);
    assert_eq!(game.snapshot().unwrap()["state"]["kills"], 0);
    game.step().unwrap();

    let mut aligned = demo("sentinel").replace("\"health\": 2", "\"health\": 1");
    for (id, x, y) in [
        (2, 12.5, 2.5),
        (3, 3.5, 6.5),
        (4, 9.5, 9.5),
        (5, 13.5, 13.5),
        (6, 2.5, 13.5),
    ] {
        aligned = aligned.replace(
            &format!("\"id\": {id}, \"x\": {x}, \"y\": {y}"),
            &format!("\"id\": {id}, \"x\": 7.5, \"y\": 3.5"),
        );
    }
    let mut game = engine(&aligned);
    game.key("Enter").unwrap();
    for _ in 0..6 {
        game.key("Space").unwrap();
        for _ in 0..3 {
            game.step().unwrap();
        }
    }
    assert_eq!(game.snapshot().unwrap()["state"]["kills"], 6);
    assert_eq!(game.snapshot().unwrap()["state"]["status"], "won");
}

#[test]
fn descent_can_be_completed_by_steering_and_shooting_every_turret() {
    let mut game = engine(&demo("descent"));
    game.key("Enter").unwrap();
    for _ in 0..2000 {
        let state = game.snapshot().unwrap()["state"].clone();
        if state["status"] != "playing" {
            break;
        }
        if let Some(target) = state["targets"]
            .as_array()
            .unwrap()
            .iter()
            .find(|t| t["visible"] == true)
        {
            let target_x = target["x"].as_f64().unwrap();
            let mut x = state["camera"]["x"].as_f64().unwrap();
            for _ in 0..12 {
                if (x - target_x).abs() < 0.55 {
                    break;
                }
                game.key(if x < target_x { "KeyD" } else { "KeyA" })
                    .unwrap();
                x = game.snapshot().unwrap()["state"]["camera"]["x"]
                    .as_f64()
                    .unwrap();
            }
            game.key("Space").unwrap();
        }
        game.step().unwrap();
    }
    let state = game.snapshot().unwrap()["state"].clone();
    assert_eq!(state["status"], "won");
    assert!(state["meters"].as_f64().unwrap() >= 1000.0);
    assert_eq!(state["shield"], 100);
    assert!(state["score"].as_u64().unwrap() >= 1000);
    assert!(state["altitude"].as_f64().unwrap() <= 1.0);
}

#[test]
fn knowledge_starter_is_runnable_with_collision_and_turning() {
    let guide = include_str!("../knowledge/runtime/ascii3d.md");
    let source = guide
        .split("```rune\n")
        .nth(1)
        .unwrap()
        .split("```")
        .next()
        .unwrap();
    let mut game = engine(source);
    game.key("ArrowLeft").unwrap();
    for _ in 0..20 {
        game.key("ArrowUp").unwrap();
        game.step().unwrap();
    }
    assert_eq!(game.frame().unwrap().width, 72);
    assert_eq!(game.snapshot().unwrap()["state"]["camera"]["angle"], 345);
}
