"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/language";

type Row = { event: string; count: number };

export default function TelemetryToday() {
  const { t } = useLanguage();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/telemetry?summary=today");
        const data = await r.json(); // [{event,count}]
        setRows(Array.isArray(data) ? data : []);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="text-sm text-muted-foreground">{t('loading_telemetry')}</div>;

  const important = new Set([
    // Clicks
    "ai_bullets_clicks",
    "ai_complete_clicks",
    "ai_improve_clicks",
    // Outcomes / states
    "avg_bullets_generated_per_click",
    "ai_bullets_fail",
    // Submission
    "cv_submit_success",
    "cv_submit_fail",
    // Guardrails
    "422_count",
    "429_count",
  ]);

  const filtered = rows.filter((r) => important.has(r.event));

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {filtered.map((r) => (
        <div key={r.event} className="rounded-2xl border p-4 shadow-xs bg-background">
          <div className="text-xs uppercase text-muted-foreground">{r.event.replaceAll("_", " ")}</div>
          <div className="text-2xl font-semibold">{r.count}</div>
        </div>
      ))}
      {filtered.length === 0 && (
        <div className="text-sm text-muted-foreground">{t('no_events_today')}</div>
      )}
    </div>
  );
}
