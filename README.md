# Haile Liao - AI Marketing & GTM Resume

A scroll-native, selectable-text web edition of Haile Liao's PowerPoint resume.

## What is preserved

- All 11 slide designs at their original 16:9 aspect ratio
- All 16 external hyperlinks from the source presentation
- Exact PowerPoint image crops, rotations, shadows, and vector backplates
- Crisp, selectable HTML text using the presentation's embedded font subsets
- Searchable mobile reading transcripts

The web layer adds restrained text entrance motion, an eight-chapter dot
navigation, an 11-page counter, a reading-progress indicator, and touch-friendly
link controls on mobile.

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
from a PPTX with `scripts/extract_pptx_links.py`. The visual and live-text layers
can be regenerated from a PowerPoint-exported PDF with:

```bash
python3 scripts/build_hybrid_resume.py /path/to/resume.pdf
```

The generated assets use a textless, high-resolution artwork layer plus
positioned HTML text. The three run-level social links on slide 6 use hand-tuned
hit areas after extraction.
