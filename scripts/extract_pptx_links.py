#!/usr/bin/env python3
"""Extract external hyperlink hotspots and slide text from a PPTX."""

from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pr": "http://schemas.openxmlformats.org/package/2006/relationships",
}
RID = f"{{{NS['r']}}}id"


def read_xml(archive: zipfile.ZipFile, path: str) -> ET.Element:
    return ET.fromstring(archive.read(path))


def relationship_map(archive: zipfile.ZipFile, slide_number: int) -> dict[str, str]:
    rel_path = f"ppt/slides/_rels/slide{slide_number}.xml.rels"
    if rel_path not in archive.namelist():
        return {}
    root = read_xml(archive, rel_path)
    links: dict[str, str] = {}
    for rel in root.findall("pr:Relationship", NS):
        if rel.get("Type", "").endswith("/hyperlink") and rel.get("TargetMode") == "External":
            links[rel.get("Id", "")] = rel.get("Target", "")
    return links


def shape_box(shape: ET.Element) -> tuple[int, int, int, int] | None:
    for path in ("p:spPr/a:xfrm", "p:xfrm", "a:xfrm"):
        xfrm = shape.find(path, NS)
        if xfrm is None:
            continue
        off = xfrm.find("a:off", NS)
        ext = xfrm.find("a:ext", NS)
        if off is not None and ext is not None:
            return (
                int(off.get("x", "0")),
                int(off.get("y", "0")),
                int(ext.get("cx", "0")),
                int(ext.get("cy", "0")),
            )
    return None


def shape_name(shape: ET.Element) -> str:
    c_nv_pr = shape.find(".//p:cNvPr", NS)
    return c_nv_pr.get("name", "") if c_nv_pr is not None else ""


def shape_text(shape: ET.Element) -> str:
    return "".join(node.text or "" for node in shape.findall(".//a:t", NS)).strip()


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: extract_pptx_links.py INPUT.pptx OUTPUT.json")

    pptx_path = Path(sys.argv[1]).expanduser().resolve()
    output_path = Path(sys.argv[2]).expanduser().resolve()

    with zipfile.ZipFile(pptx_path) as archive:
        presentation = read_xml(archive, "ppt/presentation.xml")
        size = presentation.find("p:sldSz", NS)
        if size is None:
            raise RuntimeError("presentation has no slide size")
        slide_width = int(size.get("cx", "0"))
        slide_height = int(size.get("cy", "0"))

        slide_paths = sorted(
            (
                name
                for name in archive.namelist()
                if name.startswith("ppt/slides/slide") and name.endswith(".xml")
            ),
            key=lambda name: int(Path(name).stem.removeprefix("slide")),
        )

        slides: list[dict[str, object]] = []
        for slide_path in slide_paths:
            slide_number = int(Path(slide_path).stem.removeprefix("slide"))
            links = relationship_map(archive, slide_number)
            slide = read_xml(archive, slide_path)
            hotspots: list[dict[str, object]] = []

            for shape in slide.findall(".//p:spTree/*", NS):
                box = shape_box(shape)
                if box is None:
                    continue
                relation_ids = {
                    node.get(RID, "")
                    for node in shape.findall(".//a:hlinkClick", NS)
                    if node.get(RID, "") in links
                }
                if not relation_ids:
                    continue

                x, y, width, height = box
                for relation_id in sorted(relation_ids):
                    hotspots.append(
                        {
                            "url": links[relation_id],
                            "label": shape_text(shape) or shape_name(shape) or "Open linked work",
                            "x": round(x / slide_width * 100, 5),
                            "y": round(y / slide_height * 100, 5),
                            "width": round(width / slide_width * 100, 5),
                            "height": round(height / slide_height * 100, 5),
                        }
                    )

            # De-duplicate identical shape links while preserving order.
            deduped: list[dict[str, object]] = []
            seen: set[tuple[object, ...]] = set()
            for hotspot in hotspots:
                key = (
                    hotspot["url"],
                    hotspot["x"],
                    hotspot["y"],
                    hotspot["width"],
                    hotspot["height"],
                )
                if key not in seen:
                    seen.add(key)
                    deduped.append(hotspot)

            paragraphs = []
            for paragraph in slide.findall(".//a:p", NS):
                text = "".join(node.text or "" for node in paragraph.findall(".//a:t", NS)).strip()
                if text:
                    paragraphs.append(text)

            slides.append(
                {
                    "number": slide_number,
                    "text": "\n".join(paragraphs),
                    "links": deduped,
                }
            )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(
            {
                "slideWidth": slide_width,
                "slideHeight": slide_height,
                "slides": slides,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
