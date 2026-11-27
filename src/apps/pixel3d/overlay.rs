//! Composition of the shared renderer's transparent HUD over a native frame.
#![allow(dead_code)]
use anyhow::{ensure, Result};

/// Composite packed RGBA pixels from `Raycaster3D.renderOverlay`.
///
/// The shared HUD draws fully opaque pixels and uses zero for transparency.
/// Other alpha values are rejected before modifying the destination.
pub fn composite_hud(
    frame: &mut [u32],
    overlay: &[u32],
    width: usize,
    height: usize,
) -> Result<()> {
    ensure!(
        width > 0
            && height > 0
            && width.checked_mul(height) == Some(frame.len())
            && overlay.len() == frame.len(),
        "Invalid HUD framebuffer dimensions"
    );
    ensure!(
        overlay
            .iter()
            .all(|&pixel| pixel == 0 || pixel >> 24 == 255),
        "HUD overlay must contain transparent or opaque pixels"
    );
    for (destination, &pixel) in frame.iter_mut().zip(overlay) {
        if pixel != 0 {
            *destination = pixel;
        }
    }
    Ok(())
}
