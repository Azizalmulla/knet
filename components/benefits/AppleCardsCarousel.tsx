"use client";

import React from "react";
import Image from "next/image";
import { Upload, Brain, Shield, type LucideIcon } from "lucide-react";

type Benefit = {
  title: string;
  subtitle: string;
  description: string;
  detailLeft: string;
  detailRight: string;
  color: string; // base card color
  accent?: string; // small accent orb color
  Icon: LucideIcon;
};

const benefits: Benefit[] = [
  {
    title: "Upload CV",
    subtitle: "Quick & Secure",
    description:
      "Upload your existing CV and get immediate AI-powered parsing with structured data extraction",
    detailLeft: "PDF Only",
    detailRight: "10MB Max",
    color: "#b39eb5",
    accent: "#8b5cf6",
    Icon: Upload,
  },
  {
    title: "AI CV Builder",
    subtitle: "Smart & Modern",
    description:
      "Build from scratch with our intelligent wizard featuring step-by-step guidance and real-time optimization",
    detailLeft: "ATS-Friendly",
    detailRight: "AI Powered",
    color: "#d8c29d",
    accent: "#f59e0b",
    Icon: Brain,
  },
  {
    title: "Agentic Admin Panel",
    subtitle: "Manage & Review",
    description:
      "Advanced candidate screening with natural language queries and intelligent matching algorithms",
    detailLeft: "Secure Access",
    detailRight: "Analytics",
    color: "#8a9e79",
    accent: "#10b981",
    Icon: Shield,
  },
];

function Card({ item }: { item: Benefit }) {
  const { title, subtitle, description, detailLeft, detailRight, color, accent, Icon } = item;
  return (
    <li className="group relative w-[320px] sm:w-[360px] md:w-[420px] aspect-[4/3] rounded-3xl overflow-hidden select-none">
      <div
        className="relative h-full w-full p-7 transition-transform duration-300 ease-out will-change-transform group-hover:scale-[0.98]"
        style={{ backgroundColor: color }}
      >
        {/* subtle diagonal glow on hover */}
        <div
          className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500"
          style={{
            background: `linear-gradient(135deg, ${accent ?? "#ffffff40"} 0%, transparent 100%)`,
          }}
        />

        {/* Top-left heading */}
        <div className="relative z-10 flex flex-col gap-1">
          <h3 className="text-black/90 text-xl font-semibold tracking-tight">{title}</h3>
          <p className="text-black/70 text-sm font-medium">{subtitle}</p>
        </div>

        {/* Bottom row details */}
        <div className="relative z-10 absolute inset-x-7 bottom-7 flex items-end justify-between">
          <p className="text-black/70 text-sm font-medium">{detailLeft}</p>
          <p className="text-black/85 text-lg font-semibold">{detailRight}</p>
        </div>

        {/* Center icon */}
        <div className="absolute inset-0 grid place-items-center">
          <Icon className="h-16 w-16 text-black/30 transition-transform duration-500 group-hover:scale-105" />
        </div>

        {/* Accent orb */}
        {accent && (
          <div
            className="absolute -top-24 -right-24 h-44 w-44 rounded-full blur-2xl opacity-20 group-hover:opacity-30 transition-opacity"
            style={{ backgroundColor: accent }}
          />
        )}
      </div>

      {/* Caption below card */}
      <div className="mt-6 px-2 text-center space-y-2">
        <h4 className="text-black text-base font-semibold">{title}</h4>
        <p className="text-neutral-600 text-sm leading-relaxed max-w-xs mx-auto">{description}</p>
      </div>
    </li>
  );
}

export function AppleCardsCarousel() {
  return (
    <section id="benefits" className="mx-auto max-w-7xl px-4 py-16">
      <div className="text-center mb-10 space-y-3">
        <h2 className="text-2xl md:text-3xl font-semibold bg-gradient-to-br from-white via-white to-zinc-400 bg-clip-text text-transparent">
          Benefits
        </h2>
        <p className="text-neutral-600 body-lg max-w-2xl mx-auto">
          Everything you need to create, manage, and submit professional CVs with confidence
        </p>
      </div>

      {/* Horizontal scroll like Apple cards */}
      <div className="[mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <ul className="flex gap-6 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-2">
          {benefits.map((b, i) => (
            <div key={i} className="snap-center shrink-0">
              <Card item={b} />
            </div>
          ))}
        </ul>
      </div>
    </section>
  );
}

// optional minimal scrollbar hiding for webkit browsers
// If you already have a global utility for no-scrollbar, remove this style block.
export const Noop = () => null;
