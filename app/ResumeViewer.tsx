"use client";

/* eslint-disable @next/next/no-img-element -- The textless PPT artwork is exported at 2x desktop resolution. */

import { useEffect, useRef, useState } from "react";
import pptRenderData from "./ppt-render-data.json";
import resumeData from "./resume-data.json";

type LinkHotspot = {
  url: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type SlideData = {
  number: number;
  text: string;
  links: LinkHotspot[];
};

type RenderLine = {
  id: string;
  className: string;
  top: number;
  left: number;
  delayMs: number;
  html: string;
};

type RenderSlide = {
  number: number;
  background: string;
  lines: RenderLine[];
};

const slideTitles = [
  "AI / 硬科技出海 Marketing & GTM",
  "独立产品项目 | 社群资源 AI 匹配小程序",
  "AI 产品探索 | 全球办公咖啡厅地图",
  "AI 产品探索 | AI 论坛",
  "沙特本地网红营销项目",
  "易达资本市场品牌经理 | 品牌、内容与传播",
  "易达资本市场品牌经理 | 活动与团队协作",
  "Reddit Localized Community Storytelling",
  "36氪、律新社记者",
  "返乡创业 / Up 主",
  "教育经历与联系方式",
];

const chapters = [
  { label: "个人介绍", startSlide: 0 },
  { label: "AI 产品探索", startSlide: 1 },
  { label: "沙特网红营销", startSlide: 4 },
  { label: "易达资本", startSlide: 5 },
  { label: "Reddit 社区叙事", startSlide: 7 },
  { label: "媒体记者", startSlide: 8 },
  { label: "创业与内容", startSlide: 9 },
  { label: "教育与联系", startSlide: 10 },
];

function shortLinkLabel(label: string, index: number) {
  const cleaned = label.replace(/\s+/g, " ").trim();
  return cleaned.length > 28 ? `项目链接 ${index + 1}` : cleaned;
}

function chapterForSlide(slideIndex: number) {
  let activeChapter = 0;
  chapters.forEach((chapter, chapterIndex) => {
    if (slideIndex >= chapter.startSlide) activeChapter = chapterIndex;
  });
  return activeChapter;
}

export function ResumeViewer() {
  const slides = resumeData.slides as SlideData[];
  const renderSlides = pptRenderData.slides as RenderSlide[];
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    document.documentElement.classList.add("motion-ready");
    const targets = slideRefs.current.filter(Boolean) as HTMLElement[];
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 },
    );

    const activeObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          setActiveSlide(Number((visible.target as HTMLElement).dataset.slideIndex));
        }
      },
      { rootMargin: "-30% 0px -48% 0px", threshold: [0, 0.08, 0.22, 0.45] },
    );

    targets.forEach((target) => {
      revealObserver.observe(target);
      activeObserver.observe(target);
    });

    return () => {
      document.documentElement.classList.remove("motion-ready");
      revealObserver.disconnect();
      activeObserver.disconnect();
    };
  }, []);

  const goToSlide = (index: number) => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    slideRefs.current[index]?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  const activeChapter = chapterForSlide(activeSlide);
  const fallbackProgress = `${((activeSlide + 1) / slides.length) * 100}%`;

  return (
    <>
      <div className="scroll-progress" aria-hidden="true">
        <div
          className="scroll-progress__bar"
          style={{ "--section-progress": fallbackProgress } as React.CSSProperties}
        />
      </div>

      <a className="skip-link" href="#resume-content">
        跳到简历正文
      </a>

      <main id="resume-content" className="resume" aria-label="廖丽君 Haile 个人简历">
        {slides.map((slide, index) => {
          const renderSlide = renderSlides[index];
          return (
            <section
              className={`resume-slide${index === 0 ? " is-visible" : ""}`}
              data-slide-index={index}
              id={`section-${slide.number}`}
              key={slide.number}
              ref={(element) => {
                slideRefs.current[index] = element;
              }}
              aria-labelledby={`section-title-${slide.number}`}
            >
              <h2 className="visually-hidden" id={`section-title-${slide.number}`}>
                {slideTitles[index]}
              </h2>

              <div className="slide-canvas">
                <img
                  className="slide-artwork"
                  src={renderSlide.background}
                  width={pptRenderData.width}
                  height={pptRenderData.height}
                  alt=""
                  aria-hidden="true"
                  loading={index === 0 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : "auto"}
                  decoding="async"
                />

                <div className="ppt-text-layer">
                  {renderSlide.lines.map((line) => (
                    <p
                      className={`ppt-text-line ${line.className}`}
                      key={line.id}
                      style={
                        {
                          top: `${line.top}%`,
                          left: `${line.left}%`,
                          "--reveal-delay": `${line.delayMs}ms`,
                        } as React.CSSProperties
                      }
                      dangerouslySetInnerHTML={{ __html: line.html }}
                    />
                  ))}
                </div>

                {slide.links.map((link, linkIndex) => (
                  <a
                    className="link-hotspot"
                    href={link.url}
                    key={`${link.url}-${linkIndex}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`${link.label}（在新窗口打开）`}
                    title={link.label}
                    style={
                      {
                        left: `${link.x}%`,
                        top: `${link.y}%`,
                        width: `${link.width}%`,
                        height: `${link.height}%`,
                      } as React.CSSProperties
                    }
                  >
                    <span className="visually-hidden">{link.label}</span>
                  </a>
                ))}
              </div>

              <details className="mobile-reading-view">
                <summary>阅读文字版</summary>
                <p>{slide.text}</p>
              </details>

              {slide.links.length > 0 && (
                <nav className="mobile-link-list" aria-label={`第 ${slide.number} 页项目链接`}>
                  {slide.links.map((link, linkIndex) => (
                    <a
                      href={link.url}
                      key={`mobile-${link.url}-${linkIndex}`}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {shortLinkLabel(link.label, linkIndex)}
                    </a>
                  ))}
                </nav>
              )}
            </section>
          );
        })}
      </main>

      <nav className="section-rail" aria-label="简历章节导航">
        <div className="section-rail__counter" aria-live="polite">
          <span>{String(activeSlide + 1).padStart(2, "0")}</span>
          <span className="section-rail__divider">/</span>
          <span>{String(slides.length).padStart(2, "0")}</span>
        </div>
        <div className="section-rail__chapters">
          {chapters.map((chapter, chapterIndex) => (
            <button
              type="button"
              key={chapter.label}
              onClick={() => goToSlide(chapter.startSlide)}
              className={chapterIndex === activeChapter ? "is-active" : ""}
              aria-label={`跳到${chapter.label}`}
              aria-current={chapterIndex === activeChapter ? "location" : undefined}
            >
              <span className="section-rail__label">{chapter.label}</span>
              <span className="section-rail__dot" aria-hidden="true" />
            </button>
          ))}
        </div>
      </nav>

      <div className="mobile-chapter-indicator" aria-live="polite">
        <span>
          {String(activeChapter + 1).padStart(2, "0")} / {String(chapters.length).padStart(2, "0")}
        </span>
        <strong>{chapters[activeChapter].label}</strong>
      </div>
    </>
  );
}
