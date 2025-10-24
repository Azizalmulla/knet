"use client";

import React, { useRef, useState } from "react";
import { useOutsideClick } from "@/hooks/use-outside-click";
import type { LucideIcon } from "lucide-react";

export type AppleCard = {
  category: string;
  title: string;
  content: React.ReactNode; // expanded content
  bg: string; // background color (neo-brutal)
  border: string; // border/shadow color
  accent?: string; // accent color for icon/pills
  Icon?: LucideIcon; // optional icon to render in card
};

export function Carousel({ items }: { items: React.ReactNode[] }) {
  return (
    <div className="w-full">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-6 no-scrollbar">
          {items.map((item, i) => (
            <div key={i} className="snap-start shrink-0">
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Card({ card, index }: { card: AppleCard; index: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false));

  return (
    <div className="relative">
      {/* Neo-Brutal tall card */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative w-[70vw] sm:w-[50vw] md:w-[420px] lg:w-[460px] h-[540px] rounded-[28px] overflow-hidden"
        style={{
          backgroundColor: card.bg,
          border: `4px solid ${card.border}`,
          boxShadow: `8px 8px 0 0 ${card.border}`,
        }}
      >
        {/* subtle dot grid overlay */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(currentColor 1px, transparent 1px)",
            color: card.border,
            backgroundSize: "12px 12px",
          }}
        />

        {/* content */}
        <div className="relative h-full w-full p-7 flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <span
              className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{
                backgroundColor: card.accent ?? "#fff",
                color: "#000",
                border: `2px solid ${card.border}`,
                boxShadow: `4px 4px 0 0 ${card.border}`,
              }}
            >
              {card.category}
            </span>
          </div>

          <div className="flex-1 grid place-items-center">
            {card.Icon ? (
              <card.Icon
                className="w-24 h-24"
                style={{ color: card.border }}
                strokeWidth={2.5}
              />
            ) : null}
          </div>

          <h3 className="text-2xl md:text-3xl font-extrabold text-black leading-tight">
            {card.title}
          </h3>
        </div>
      </button>

      {/* Expanded content modal */}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 backdrop-blur-sm p-4">
          <div
            ref={ref}
            className="relative w-full max-w-3xl max-h-[85vh] overflow-auto rounded-[28px] bg-white border-[4px] border-black p-6 md:p-8 shadow-[8px_8px_0_#111]"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-sm text-neutral-600 hover:text-black"
            >
              Close
            </button>
            {card.content}
          </div>
        </div>
      )}
    </div>
  );
}
