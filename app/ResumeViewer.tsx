"use client";

/* eslint-disable @next/next/no-img-element -- Exact PowerPoint raster exports preserve the source design. */

import { useEffect, useRef, useState } from "react";
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

const slideTitles = [
  "AI / 新媒体品牌 Marketing & GTM",
  "独立产品项目 | 社群资源 AI 匹配小程序",
  "AI 产品探索 | 全球沙龙辅助地图",
  "AI 产品探索 | AI 论坛",
  "沙特本地网红营销项目",
  "易达资本市场品牌经理 | 品牌、内容与传播",
  "易达资本市场品牌经理 | 活动与团队协作",
  "Reddit Localized Community Storytelling",
  "36氪、律新社记者",
  "返乡创业 / Up 主",
  "教育经历",
];

function slideImagePath(number: number) {
  return `/slides/slide-${String(number).padStart(2, "0")}.png`;
}

function shortLinkLabel(label: string, index: number) {
  const cleaned = label.replace(/\s+/g, " ").trim();
  return cleaned.length > 28 ? `项目链接 ${index + 1}` : cleaned;
}

export function ResumeViewer() {
  const slides = resumeData.slides as SlideData[];
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
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
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
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
      { rootMargin: "-28% 0px -48% 0px", threshold: [0, 0.1, 0.25, 0.5] },
    );

    targets.forEach((target) => {
      revealObserver.observe(target);
      activeObserver.observe(target);
    });

    return () => {
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
        {slides.map((slide, index) => (
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
            <div className="slide-canvas">
              <img
                className="slide-image"
                src={slideImagePath(slide.number)}
                width={2304}
                height={1296}
                alt={`${slideTitles[index]}页面`}
                loading={index === 0 ? "eager" : "lazy"}
                fetchPriority={index === 0 ? "high" : "auto"}
                decoding="async"
              />

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

            <div className="visually-hidden">
              <h2 id={`section-title-${slide.number}`}>{slideTitles[index]}</h2>
              <p>{slide.text}</p>
            </div>
          </section>
        ))}
      </main>

      <nav className="section-rail" aria-label="简历章节导航">
        {slides.map((slide, index) => (
          <button
            type="button"
            key={slide.number}
            onClick={() => goToSlide(index)}
            className={index === activeSlide ? "is-active" : ""}
            aria-label={`跳到第 ${slide.number} 页：${slideTitles[index]}`}
            aria-current={index === activeSlide ? "location" : undefined}
            title={slideTitles[index]}
          >
            {String(slide.number).padStart(2, "0")}
          </button>
        ))}
      </nav>

    </>
  );
}
