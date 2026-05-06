# Teaching Website i18n Quick Reference

## Current Locales

| Code | Language | File | Status |
|------|----------|------|--------|
| `en_us` | English (US) | `i18n/en_us.rune` | ✅ Default |
| `es` | Spanish | `i18n/es.rune` | ✅ Complete |
| `fr` | French | `i18n/fr.rune` | ✅ Complete |

## Change Active Locale

Edit `teaching.rune`:
```rune
@Frontend
locale = en_us    # Change to: es, fr, or other codes
```

## Translation File Location

All localization files are in:
```
teaching_website/parts/i18n/
```

## Adding New Language in 3 Steps

1. **Copy template**:
```bash
cp parts/l10n/en_us.rune parts/l10n/XX.rune
# Replace XX with language code
```
Copy `parts/i18n/en_us.rune` to `parts/i18n/XX.rune`, then add the new import to `parts/i18n.rune`.
2. **Translate all keys** to the target language

3. **Set as active**:
```rune
@Frontend
locale = XX
```

## Common Translation Groups

- **Common**: app_name, tagline
- **Header**: Navigation links (nav_quickstart, nav_tour, etc.)
- **Hero**: Main introduction (headline, lead, cta buttons)
- **Quickstart**: Installation instructions
- **LanguageTour**: Language concepts
- **Walkthrough**: Tutorial steps
- **Examples**: Example descriptions
- **WhatsNext**: Roadmap
- **Footer**: Copyright

## Component Structure

All 8 components use i18n syntax:
```rune
@Component/SectionName
view:
    ...
    h1 "%i18n.Group.key%"
    p "%i18n.Group.key%"
```

## Testing a Locale

```bash
# Set locale in teaching.rune
@Frontend locale = es

# Run dev server
vectrune teaching_website/teaching.rune

# Visit http://localhost:3000
```

## Translation Key Examples

```
– English: "Learn Vectrune"
– Spanish: "Aprende Vectrune"
– French: "Apprendre Vectrune"

Key: Header.brand_name
```

## Import System

`teaching.rune` imports:
```rune
import "parts"        # All components, page, style
import "parts"        # Includes `parts/i18n.rune`, which imports all locales
```

## Running All Tests

```bash
cargo test --lib --test integration_app --test imports_test

# Result: 38 tests pass ✅
```

## File Organization

```
teaching_website/
├── teaching.rune         # Main entry + locale selector
├── parts/
│   ├── components.rune   # Component imports
│   ├── page.rune         # Page definition (uses i18n)
│   ├── style.rune        # CSS styles
│   ├── components/       # 8 component files (i18n enabled)
│   └── i18n/            # Translation files
│       ├── en_us.rune
│       ├── es.rune
│       └── fr.rune
└── LOCALIZATION.md      # Full documentation
```

## Quick Commands

```bash
# View specific locale
cat teaching_website/parts/i18n/es.rune

# Edit locale
nano teaching_website/parts/i18n/es.rune

# Switch to Spanish
sed -i 's/locale = en_us/locale = es/' teaching_website/teaching.rune

# Run locale
vectrune teaching_website/teaching.rune

# Verify tests pass
cargo test
```

## Translation Coverage

| Metric | Count |
|--------|-------|
| Total groups | 10 |
| Total keys | 150+ |
| Languages | 3 |
| Components with i18n | 8/8 (100%) |

## Fallback Behavior

If a translation key is missing:
- SSR: Renders as empty string (graceful)
- JS: Attempts path resolution (returns empty if not found)

## Performance

- All locales loaded at startup (~6KB total)
- No server round-trip for locale switching
- Instant client-side rendering
- No performance penalty between locales

## Support

For detailed information, see `teaching_website/LOCALIZATION.md`

