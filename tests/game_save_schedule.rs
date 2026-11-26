use rune_runtime::{
    apps::{pixel, pixel3d},
    rune_ast::{RuneDocument, Value},
    rune_parser::{load_rune_document_from_path, parse_rune},
};
use serde_json::{json, Value as Json};
use std::path::Path;

fn config(doc: &RuneDocument, is_3d: bool) -> anyhow::Result<Json> {
    if is_3d {
        Ok(pixel3d::compile(doc)?.config)
    } else {
        let game = pixel::compile(doc)?;
        let (_, tail) = game
            .script
            .split_once("__RunePixelRuntime.configure(")
            .unwrap();
        Ok(serde_json::Deserializer::from_str(tail)
            .into_iter::<Json>()
            .next()
            .unwrap()?)
    }
}

#[test]
fn game_compilers_validate_optional_save_schedules_and_revisions() {
    for is_3d in [false, true] {
        let (path, scene, state, logic) = if is_3d {
            (
                "examples/games/idle_aquarium/idle_aquarium.rune",
                "aquarium",
                "progress",
                "aquarium",
            )
        } else {
            (
                "examples/games/monster_city/monster_city.rune",
                "city",
                "profile",
                "monster",
            )
        };
        let mut doc = load_rune_document_from_path(Path::new(path)).unwrap();
        if !is_3d {
            doc.sections.extend(
                parse_rune(&format!("@Logic/{logic}\nstate:\n    save_revision = 0\n"))
                    .unwrap()
                    .sections,
            );
        }
        for interval in [1, 150, 3600] {
            let save = json!({"key":"schedule-test","state":state,"interval_ticks":interval,"revision":"save_revision"});
            doc.sections
                .iter_mut()
                .find(|s| s.path == ["Scene", scene])
                .unwrap()
                .kv
                .insert("persistence".into(), Value::String(save.to_string()));
            let actual = config(&doc, is_3d).unwrap();
            assert_eq!(actual["persistence"]["interval_ticks"], interval);
            assert_eq!(actual["persistence"]["revision"], "save_revision");
        }
        for (interval, revision, error) in [
            (json!(0), json!("save_revision"), "interval_ticks"),
            (json!(1.5), json!("save_revision"), "interval_ticks"),
            (json!(3601), json!("save_revision"), "interval_ticks"),
            (json!("150"), json!("save_revision"), "interval_ticks"),
            (
                json!(150),
                json!("missing_revision"),
                "state field is missing",
            ),
            (json!(150), json!(false), "must name a state field"),
        ] {
            let save = json!({"key":"schedule-test","state":state,"interval_ticks":interval,"revision":revision});
            doc.sections
                .iter_mut()
                .find(|s| s.path == ["Scene", scene])
                .unwrap()
                .kv
                .insert("persistence".into(), Value::String(save.to_string()));
            assert!(config(&doc, is_3d).unwrap_err().to_string().contains(error));
        }
    }
}
