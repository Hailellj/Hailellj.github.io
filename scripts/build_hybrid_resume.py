#!/usr/bin/env python3
"""Build the crisp HTML/PPT hybrid layers used by the resume site.

The PowerPoint PDF is the visual oracle. Poppler separates its text from the
page artwork, giving us an exact, textless background plus positioned HTML.
Embedded font subsets are remapped from their PDF character codes to Unicode
and shipped as WOFF2 so the browser keeps PowerPoint's line breaks.
"""

from __future__ import annotations

import argparse
import html as stdlib_html
import json
import re
import shutil
import subprocess
import tempfile
from io import BytesIO
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._c_m_a_p import CmapSubtable
from fontTools.fontBuilder import FontBuilder
from lxml import etree, html
from pypdf import PdfReader


PDFTOHTML = Path(
    "/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/"
    "dependencies/native/poppler/poppler/bin/pdftohtml"
)
PAGE_WIDTH = 3456
PAGE_HEIGHT = 1944


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path, help="PowerPoint-exported PDF")
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
    )
    return parser.parse_args()


def parse_to_unicode(cmap_bytes: bytes) -> dict[int, int]:
    """Return PDF source-code -> Unicode codepoint mappings."""

    source = cmap_bytes.decode("latin-1")
    mapping: dict[int, int] = {}

    for block in re.findall(r"beginbfchar(.*?)endbfchar", source, re.S):
        for encoded, decoded in re.findall(
            r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", block
        ):
            raw = bytes.fromhex(decoded)
            try:
                value = raw.decode("utf-16-be")
            except UnicodeDecodeError:
                continue
            if len(value) == 1:
                mapping[int(encoded, 16)] = ord(value)

    for block in re.findall(r"beginbfrange(.*?)endbfrange", source, re.S):
        array_ranges = re.findall(
            r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[(.*?)\]",
            block,
            re.S,
        )
        for start, end, values in array_ranges:
            decoded_values = re.findall(r"<([0-9A-Fa-f]+)>", values)
            for offset, source_code in enumerate(
                range(int(start, 16), int(end, 16) + 1)
            ):
                if offset >= len(decoded_values):
                    break
                raw = bytes.fromhex(decoded_values[offset])
                try:
                    value = raw.decode("utf-16-be")
                except UnicodeDecodeError:
                    continue
                if len(value) == 1:
                    mapping[source_code] = ord(value)

        block_without_arrays = re.sub(
            r"<[0-9A-Fa-f]+>\s*<[0-9A-Fa-f]+>\s*\[.*?\]",
            "",
            block,
            flags=re.S,
        )
        for start, end, decoded in re.findall(
            r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>",
            block_without_arrays,
        ):
            raw = bytes.fromhex(decoded)
            try:
                initial = raw.decode("utf-16-be")
            except UnicodeDecodeError:
                continue
            if len(initial) != 1:
                continue
            initial_codepoint = ord(initial)
            for offset, source_code in enumerate(
                range(int(start, 16), int(end, 16) + 1)
            ):
                mapping[source_code] = initial_codepoint + offset

    return mapping


def safe_font_filename(base_font: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", base_font).strip("-") + ".woff2"


def extract_webfonts(pdf_path: Path, output_dir: Path) -> dict[str, str]:
    output_dir.mkdir(parents=True, exist_ok=True)
    reader = PdfReader(str(pdf_path))
    emitted: dict[str, str] = {}

    for page in reader.pages:
        resources = page.get("/Resources")
        if not resources or "/Font" not in resources:
            continue
        fonts = resources["/Font"].get_object()
        for font_reference in fonts.values():
            pdf_font = font_reference.get_object()
            base_font = str(pdf_font.get("/BaseFont", "")).lstrip("/")
            if not base_font or base_font in emitted:
                continue

            descriptor_reference = pdf_font.get("/FontDescriptor")
            cmap_reference = pdf_font.get("/ToUnicode")
            if not descriptor_reference or not cmap_reference:
                continue
            descriptor = descriptor_reference.get_object()
            stream_reference = descriptor.get("/FontFile2")
            if not stream_reference:
                continue

            font = TTFont(BytesIO(stream_reference.get_object().get_data()))
            source_cmap = next(
                (table.cmap for table in font["cmap"].tables if table.cmap), None
            )
            if not source_cmap:
                continue

            unicode_by_source = parse_to_unicode(
                cmap_reference.get_object().get_data()
            )
            unicode_cmap = {
                unicode_codepoint: source_cmap[source_code]
                for source_code, unicode_codepoint in unicode_by_source.items()
                if source_code in source_cmap and unicode_codepoint <= 0xFFFF
            }
            if 0x20 in unicode_cmap:
                unicode_cmap.setdefault(0xA0, unicode_cmap[0x20])

            for platform_id, encoding_id in ((0, 3), (3, 1)):
                table = CmapSubtable.newSubtable(4)
                table.platformID = platform_id
                table.platEncID = encoding_id
                table.language = 0
                table.cmap = unicode_cmap
                font["cmap"].tables.insert(0, table)

            weight, font_style = font_weight_and_style(base_font)
            hhea = font["hhea"]
            head = font["head"]
            selection = 0x20 if weight >= 700 else 0x40
            if font_style == "italic":
                selection |= 0x01
            builder = FontBuilder(font=font)
            builder.setupOS2(
                usWeightClass=weight,
                usWidthClass=5,
                fsType=0,
                fsSelection=selection,
                sTypoAscender=hhea.ascent,
                sTypoDescender=hhea.descent,
                sTypoLineGap=hhea.lineGap,
                usWinAscent=max(hhea.ascent, head.yMax, 0),
                usWinDescent=abs(min(hhea.descent, head.yMin, 0)),
                sxHeight=round(font["head"].unitsPerEm * 0.52),
                sCapHeight=round(font["head"].unitsPerEm * 0.72),
                usDefaultChar=0,
                usBreakChar=32,
            )
            if "post" not in font:
                builder.setupPost(keepGlyphNames=True)

            filename = safe_font_filename(base_font)
            font.flavor = "woff2"
            font.save(output_dir / filename)
            emitted[base_font] = filename

    return emitted


def css_value(declarations: str, name: str) -> str | None:
    match = re.search(rf"(?:^|;)\s*{re.escape(name)}\s*:\s*([^;]+)", declarations)
    return match.group(1).strip() if match else None


def px_number(value: str | None) -> float | None:
    if value is None:
        return None
    match = re.fullmatch(r"(-?[0-9.]+)px", value)
    return float(match.group(1)) if match else None


def font_weight_and_style(family: str) -> tuple[int, str]:
    lowered = family.lower()
    weight = 700 if "bold" in lowered else 400
    style = "italic" if "italic" in lowered else "normal"
    return weight, style


def parse_font_styles(
    document_text: str, webfonts: dict[str, str]
) -> tuple[dict[str, dict[str, object]], str]:
    styles: dict[str, dict[str, object]] = {}
    font_faces: dict[str, tuple[str, int, str]] = {}

    for class_name, declarations in re.findall(
        r"\.(ft\d+)\s*\{([^}]*)\}", document_text
    ):
        family = css_value(declarations, "font-family")
        size = px_number(css_value(declarations, "font-size"))
        color = css_value(declarations, "color") or "#405449"
        line_height = px_number(css_value(declarations, "line-height"))
        if not family or size is None:
            continue
        weight, font_style = font_weight_and_style(family)
        styles[class_name] = {
            "family": family,
            "fontSizeCqw": round(size / PAGE_WIDTH * 100, 6),
            "lineHeightCqw": (
                round(line_height / PAGE_WIDTH * 100, 6)
                if line_height is not None
                else None
            ),
            "color": color,
            "weight": weight,
            "style": font_style,
        }
        if family in webfonts:
            font_faces[family] = (webfonts[family], weight, font_style)

    css_lines = [
        "/* Generated from the embedded PowerPoint PDF font subsets. */",
    ]
    for family, (filename, weight, font_style) in sorted(font_faces.items()):
        css_lines.extend(
            [
                "@font-face {",
                f'  font-family: "{family}";',
                f'  src: url("/fonts/ppt/{filename}") format("woff2");',
                f"  font-weight: {weight};",
                f"  font-style: {font_style};",
                "  font-display: block;",
                "}",
                "",
            ]
        )
    for class_name, values in sorted(styles.items()):
        declarations = [
            f'font-family: "{values["family"]}";',
            f'font-size: {values["fontSizeCqw"]}cqw;',
            f'font-weight: {values["weight"]};',
            f'font-style: {values["style"]};',
            f'color: {values["color"]};',
        ]
        if values["lineHeightCqw"] is not None:
            declarations.append(f'line-height: {values["lineHeightCqw"]}cqw;')
        css_lines.append(f".{class_name} {{ {' '.join(declarations)} }}")

    return styles, "\n".join(css_lines) + "\n"


def element_inner_html(element: etree._Element) -> str:
    parts: list[str] = []
    if element.text:
        parts.append(stdlib_html.escape(element.text))
    for child in element:
        parts.append(etree.tostring(child, encoding="unicode", method="html"))
    return "".join(parts)


def sanitize_line(element: etree._Element) -> str:
    for anchor in element.xpath(".//a"):
        anchor.set("target", "_blank")
        anchor.set("rel", "noopener noreferrer")

    text = "".join(element.itertext()).replace("\xa0", " ").strip()
    if text == "18221188501":
        return '<a href="tel:+8618221188501"><b>18221188501</b></a>'
    if text == "lijun_liao10@163.com":
        return (
            '<a href="mailto:lijun_liao10@163.com">'
            "<b>lijun_liao10@163.com</b></a>"
        )
    return element_inner_html(element)


def parse_position(style: str, name: str) -> float:
    value = px_number(css_value(style, name))
    if value is None:
        raise ValueError(f"Missing {name} in {style!r}")
    return value


def build_slide_data(document_path: Path) -> tuple[list[dict[str, object]], str]:
    document_text = document_path.read_text(encoding="utf-8")
    tree = html.fromstring(document_text)
    slides: list[dict[str, object]] = []

    for number in range(1, 12):
        page = tree.get_element_by_id(f"page{number}-div")
        page_style = page.get("style", "")
        width = parse_position(page_style, "width")
        height = parse_position(page_style, "height")
        elements = page.xpath("./p")
        top_values = [
            parse_position(element.get("style", ""), "top") for element in elements
        ]
        ordered_bands = sorted({round(top / 20) for top in top_values})
        reveal_order_by_band = {
            band: min(index, 7) for index, band in enumerate(ordered_bands)
        }
        lines: list[dict[str, object]] = []

        for index, element in enumerate(elements):
            style = element.get("style", "")
            top = parse_position(style, "top")
            left = parse_position(style, "left")
            band = round(top / 20)
            reveal_order = reveal_order_by_band[band]
            lines.append(
                {
                    "id": f"s{number}-line-{index + 1}",
                    "className": element.get("class", ""),
                    "top": round(top / height * 100, 6),
                    "left": round(left / width * 100, 6),
                    "delayMs": reveal_order * 55,
                    "html": sanitize_line(element),
                }
            )

        slides.append(
            {
                "number": number,
                "background": f"/backgrounds/resume-{number:02d}.png",
                "lines": lines,
            }
        )

    return slides, document_text


def render_pdf_layers(pdf_path: Path, destination: Path) -> Path:
    if not PDFTOHTML.exists():
        raise FileNotFoundError(f"pdftohtml not found at {PDFTOHTML}")
    destination.mkdir(parents=True, exist_ok=True)
    document_path = destination / "resume.html"
    subprocess.run(
        [
            str(PDFTOHTML),
            "-c",
            "-hidden",
            "-nodrm",
            "-noframes",
            "-fontfullname",
            "-zoom",
            "3",
            str(pdf_path),
            str(document_path),
        ],
        check=True,
    )
    return document_path


def main() -> None:
    args = parse_args()
    project_root = args.project_root.resolve()
    backgrounds_dir = project_root / "public" / "backgrounds"
    fonts_dir = project_root / "public" / "fonts" / "ppt"
    data_path = project_root / "app" / "ppt-render-data.json"
    css_path = project_root / "app" / "ppt-fonts.css"

    for directory in (backgrounds_dir, fonts_dir):
        if directory.exists():
            shutil.rmtree(directory)
        directory.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="resume-pdf-") as temporary:
        temporary_path = Path(temporary)
        document_path = render_pdf_layers(args.pdf.resolve(), temporary_path)
        slides, document_text = build_slide_data(document_path)
        for number in range(1, 12):
            shutil.copy2(
                temporary_path / f"resume{number:03d}.png",
                backgrounds_dir / f"resume-{number:02d}.png",
            )

    webfonts = extract_webfonts(args.pdf.resolve(), fonts_dir)
    _, stylesheet = parse_font_styles(document_text, webfonts)
    data_path.write_text(
        json.dumps({"width": PAGE_WIDTH, "height": PAGE_HEIGHT, "slides": slides}, ensure_ascii=False, indent=2)
        + "\n",
        encoding="utf-8",
    )
    css_path.write_text(stylesheet, encoding="utf-8")

    print(f"Generated {len(slides)} slide layers")
    print(f"Generated {len(webfonts)} embedded webfont subsets")


if __name__ == "__main__":
    main()
