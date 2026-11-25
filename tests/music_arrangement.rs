use rune_runtime::{apps::rune_web::parser::parse_rune_web_frontend, rune_parser::parse_rune};

fn score(
    fields: &str,
) -> Result<
    rune_runtime::apps::rune_web::ast::RuneWebFrontend,
    rune_runtime::apps::rune_web::parser::ParseError,
> {
    let source = format!("@Page/home\nview:\n    p \"Score\"\n\n@Music/odyssey\n{fields}\n");
    let doc = parse_rune(&source).unwrap();
    parse_rune_web_frontend(&doc, "home")
}

#[test]
fn parses_reusable_sections_and_preserves_song_form_for_both_hosts() {
    let frontend = score(r#"
tempo = 128
instruments = {"lead":"brass","harmony":"strings","bells":"bell"}
sections = {"verse":{"bars":1,"lead":"D5:4 A4:4 B4:4 D5:4"},"chorus":{"bars":2,"lead":"A5:1 D5:1"},"bridge":{"bars":1,"harmony":"[G4,B4,D5]:1"}}
arrangement = ["verse",{"section":"chorus","repeat":2},"bridge","chorus"]
"#).unwrap();
    let song = &frontend.music["odyssey"];
    assert_eq!(song.sections.len(), 3);
    assert_eq!(song.arrangement.len(), 4);
    assert_eq!(song.instruments["lead"], "brass");
    assert!(song.tracks.is_empty());
    assert!(song.lead.is_none());
    let json = serde_json::to_value(song).unwrap();
    assert_eq!(json["arrangement"][1]["section"], "chorus");
    assert_eq!(json["sections"]["verse"]["lead"], "D5:4 A4:4 B4:4 D5:4");
}

#[test]
fn parses_song_effects_and_per_track_sends() {
    let frontend = score(r#"
tempo = 140
instruments = {"lead":"sawtooth","bass":"triangle","drums":"drums"}
effects = {
    "reverb": {"decay": 2.2, "wet": 0.3},
    "delay": {"time": 0.25, "feedback": 0.35, "wet": 0.2, "damping": 3200},
    "filter": {"type": "lowpass", "cutoff": 5000, "q": 1.2},
    "crush": {"bits": 8, "drive": 0.25},
    "chorus": {"rate": 1.2, "wet": 0.28}
}
track_effects = {
    "lead": {"reverb": 0.4, "delay": 0.35},
    "bass": {"reverb": 0, "delay": 0}
}
sections = {"main":{"bars":1,"lead":"E5:1"}}
arrangement = ["main"]
"#).unwrap();
    let song = &frontend.music["odyssey"];
    assert!(song.effects.is_some());
    assert!(song.track_effects.is_some());
    let fx = song.effects.as_ref().unwrap();
    assert_eq!(fx["reverb"]["decay"], 2.2);
    assert_eq!(fx["delay"]["time"], 0.25);
    assert_eq!(fx["filter"]["type"], "lowpass");
    assert_eq!(fx["crush"]["bits"], 8.0);
    assert_eq!(fx["chorus"]["rate"], 1.2);
    let track_fx = song.track_effects.as_ref().unwrap();
    assert_eq!(track_fx["lead"]["reverb"], 0.4);
    assert_eq!(track_fx["bass"]["reverb"], 0.0);
}

#[test]
fn rejects_bad_song_forms_before_export() {
    let section = r#"sections = {"verse":{"bars":1,"lead":"D5:1"}}"#;
    for tail in [
        r#"arrangement = ["missing"]"#,
        r#"arrangement = [{"section":"verse","repeat":0}]"#,
        r#"arrangement = [{"section":"verse","repeat":1.5}]"#,
        r#"arrangement = [{"section":"verse","repeat":17}]"#,
        "arrangement = [\"verse\"]\nbars = 4",
        "arrangement = [\"verse\"]\nlead = D5:1",
        "arrangement = [\"verse\"]\ntime_signature = 6/8",
        "arrangement = [\"verse\"]\ninstruments = {\"lead\":\"missing\"}",
    ] {
        assert!(
            score(&format!("{section}\n{tail}")).is_err(),
            "Accepted invalid form: {tail}"
        );
    }
    assert!(score(
        "sections = {\"verse\":{\"bars\":0,\"lead\":\"D5:1\"}}\narrangement = [\"verse\"]"
    )
    .is_err());
    assert!(score("sections = {\"verse\":{\"bars\":64,\"lead\":\"D5:1\"}}\narrangement = [{\"section\":\"verse\",\"repeat\":16}]").is_err());
}
