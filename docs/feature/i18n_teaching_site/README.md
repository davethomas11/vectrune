# I18N Teaching Site Feature

This directory contains documentation for the internationalization (i18n) feature integrated into the Vectrune teaching website.

## Files

- **TEACHING_SITE_LOCALIZATION_SUMMARY.md** - High-level overview of the localization implementation
- **I18N_IMPLEMENTATION.md** - Technical details about the i18n engine architecture
- **teaching_website/LOCALIZATION.md** - Comprehensive guide for adding/maintaining translations
- **teaching_website/I18N_QUICK_REF.md** - Quick reference for developers

## Quick Start

The teaching website supports 3 languages (English, Spanish, French) with a language dropdown selector.

### Switch Languages

Use the language dropdown in the page header to instantly switch between:
- English (en_us)
- Español (es)
- Français (fr)

### Add New Language

1. Create `teaching_website/parts/i18n/XX.rune`
2. Translate all keys from English
3. Language automatically available in dropdown

## Status

✅ Complete:
- 3 languages fully translated
- Language dropdown integrated
- All components i18n-enabled
- Instant client-side switching

## Next Steps

- Add more languages (German, Japanese, etc.)
- Community translation contributions
- Translation management UI
- Locale cookie persistence

