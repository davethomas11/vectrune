//! Local JSON saves for the native host; the web host uses localStorage.
use anyhow::{ensure, Context as _, Result};
use std::path::{Path, PathBuf};

fn path(root: &Path, key: &str) -> Result<PathBuf> {
    ensure!(
        !key.is_empty()
            && key.len() <= 96
            && key
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_'),
        "Invalid save key"
    );
    Ok(root.join(format!("{key}.json")))
}
fn read(root: &Path, key: &str) -> Result<Option<String>> {
    let path = path(root, key)?;
    match std::fs::metadata(&path) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        result => ensure!(result?.len() <= 65536, "Save file too large"),
    }
    Ok(Some(std::fs::read_to_string(path)?))
}
fn write(root: &Path, key: &str, value: &str) -> Result<()> {
    use std::io::Write;
    ensure!(value.len() <= 65536, "Save file too large");
    let _: serde_json::Value = serde_json::from_str(value).context("Save must be JSON")?;
    let path = path(root, key)?;
    std::fs::create_dir_all(root)?;
    let mut file = tempfile::NamedTempFile::new_in(root)?;
    file.write_all(value.as_bytes())?;
    file.as_file().sync_all()?;
    file.persist(path)?;
    Ok(())
}
pub fn install(context: &rquickjs::Context, root: PathBuf) -> Result<()> {
    context.with(|ctx| -> Result<()> {
        let reads = root.clone();
        ctx.globals().set(
            "__runeStoreGet",
            rquickjs::Function::new(ctx.clone(), move |key: String| {
                read(&reads, &key).map_err(|e| {
                    rquickjs::Error::new_from_js_message("save", "JSON", e.to_string())
                })
            })?,
        )?;
        let writes = root.clone();
        ctx.globals().set(
            "__runeStoreSet",
            rquickjs::Function::new(ctx.clone(), move |key: String, value: String| {
                write(&writes, &key, &value).map_err(|e| {
                    rquickjs::Error::new_from_js_message("save", "JSON", e.to_string())
                })
            })?,
        )?;
        ctx.globals().set(
            "__runeStoreRemove",
            rquickjs::Function::new(ctx.clone(), move |key: String| -> rquickjs::Result<()> {
                let path = path(&root, &key).map_err(|e| {
                    rquickjs::Error::new_from_js_message("save", "JSON", e.to_string())
                })?;
                match std::fs::remove_file(path) {
                    Ok(()) => Ok(()),
                    Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
                    Err(e) => Err(rquickjs::Error::new_from_js_message(
                        "save",
                        "JSON",
                        e.to_string(),
                    )),
                }
            })?,
        )?;
        Ok(())
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn native_game_restores_purchased_skin_wallet_and_progress() {
        let dir = tempfile::tempdir().unwrap();
        let doc = crate::rune_parser::load_rune_document_from_path(Path::new(
            "examples/monster_city/monster_city.rune",
        ))
        .unwrap();
        let game = crate::apps::pixel::compile(&doc).unwrap();
        for first in [true, false] {
            let runtime = rquickjs::Runtime::new().unwrap();
            let context = rquickjs::Context::full(&runtime).unwrap();
            install(&context, dir.path().to_path_buf()).unwrap();
            context.with(|ctx| {
                ctx.eval::<(),_>(game.script.as_str()).unwrap();
                if first {
                    ctx.eval::<(),_>("__RunePixel.app.state.profile.coins=300; __RunePixel.app.state.profile.level=5; __RunePixel.invoke('openStore'); __RunePixel.invoke('chooseSkin',['ember'])").unwrap();
                } else {
                    assert_eq!(ctx.eval::<u32,_>("__RunePixel.app.state.profile.coins").unwrap(),180);
                    assert_eq!(ctx.eval::<u32,_>("__RunePixel.app.state.profile.level").unwrap(),5);
                    assert_eq!(ctx.eval::<String,_>("__RunePixel.app.state.profile.skin").unwrap(),"ember");
                    assert_eq!(ctx.eval::<String,_>("__RunePixel.saveStatus").unwrap(),"saved");
                }
            });
        }
    }
    #[test]
    fn json_save_survives_reopen_and_atomic_replacement() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(read(dir.path(), "game").unwrap(), None);
        write(dir.path(), "game", r#"{"coins":50}"#).unwrap();
        write(dir.path(), "game", r#"{"coins":20}"#).unwrap();
        assert_eq!(
            read(dir.path(), "game").unwrap().unwrap(),
            r#"{"coins":20}"#
        );
        assert!(write(dir.path(), "../escape", "{}").is_err());
        assert!(write(dir.path(), "game", "not json").is_err());
        assert!(write(dir.path(), "game", &" ".repeat(65537)).is_err());
        assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), 1);
    }
}
