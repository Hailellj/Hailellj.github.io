# Haile Liao - AI Marketing & GTM Resume

A scroll-native web edition of Haile Liao's PowerPoint resume.

## What is preserved

- All 11 slide designs at their original 16:9 aspect ratio
- All 16 external hyperlinks from the source presentation
- High-resolution PowerPoint-rendered visual assets
- Searchable, screen-reader-friendly slide transcripts

The web layer adds restrained entrance motion, a reading-progress indicator,
wide-screen section navigation, and touch-friendly link controls on mobile.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Validation

```bash
npm run build
npm run lint
```

After a content update, publish the current static build with:

```bash
npm run deploy:github
```

The hyperlink and transcript data in `app/resume-data.json` can be regenerated
from a PPTX with `scripts/extract_pptx_links.py`. The three run-level social
links on slide 6 use hand-tuned hit areas after extraction.
