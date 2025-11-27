"use client";

import React from "react";
import { Carousel, Card } from "@/components/ui/apple-cards-carousel";
import { Upload, Sparkles, Shield, LayoutDashboard, Lightbulb, BarChart3, Building2, Lock } from "lucide-react";

export function AppleCardsCarouselDemo() {
  const cards = data.map((card, index) => (
    <Card key={card.title} card={card} index={index} />
  ));

  return (
    <div className="w-full h-full py-20 space-y-16 md:space-y-24">
      <h2 className="max-w-7xl pl-4 mx-auto text-xl md:text-5xl font-bold font-sans" style={{ color: "#000" }}>
        Get to know Wathefni AI.
      </h2>
      <Carousel items={cards} />
    </div>
  );
}

const UploadContent = () => (
  <div className="bg-[#d5ddd8] p-8 md:p-14 rounded-3xl space-y-6 border-4 border-black shadow-[8px_8px_0_0_#000]">
    <h3 className="text-xl md:text-2xl font-semibold text-neutral-800">Instant CV Parsing</h3>
    <ul className="list-disc pl-5 text-neutral-700 space-y-2">
      <li>Upload PDF and get structured data in seconds</li>
      <li>Accurate extraction of experience, education, and skills</li>
      <li>Privacy-first processing with secure storage</li>
    </ul>
  </div>
);

const BuilderContent = () => (
  <div className="bg-[#ddd5d8] p-8 md:p-14 rounded-3xl space-y-6 border-4 border-black shadow-[8px_8px_0_0_#000]">
    <h3 className="text-xl md:text-2xl font-semibold">AI CV Builder</h3>
    <ul className="list-disc pl-5 text-neutral-700 space-y-2">
      <li>Guided steps to craft an ATS-ready resume</li>
      <li>Real-time suggestions and consistency checks</li>
      <li>Export to PDF with clean, modern templates</li>
    </ul>
  </div>
);

const AdminContent = () => (
  <div className="bg-[#d2dbd5] p-8 md:p-14 rounded-3xl space-y-6 border-4 border-black shadow-[8px_8px_0_0_#000]">
    <h3 className="text-xl md:text-2xl font-semibold text-neutral-800">Agentic Admin Insights</h3>
    <ul className="list-disc pl-5 text-neutral-700 space-y-2">
      <li>Search candidates with natural language queries</li>
      <li>Multi-tenant, org-scoped dashboards and analytics</li>
      <li>Secure access with rate limiting and audit logs</li>
    </ul>
  </div>
);

const StudentDashboardContent = () => (
  <div className="bg-[#d5d8dc] p-8 md:p-14 rounded-3xl space-y-6 border-4 border-black shadow-[8px_8px_0_0_#000]">
    <h3 className="text-xl md:text-2xl font-semibold text-neutral-800">Student Dashboard</h3>
    <ul className="list-disc pl-5 text-neutral-700 space-y-2">
      <li>View all your submissions across organizations</li>
      <li>Track status, feedback and next steps in one place</li>
      <li>Login with Google or Microsoft (NextAuth)</li>
    </ul>
  </div>
);

const SkillGapContent = () => (
  <div className="bg-[#e0d6cb] p-8 md:p-14 rounded-3xl space-y-6 border-4 border-black shadow-[8px_8px_0_0_#000]">
    <h3 className="text-xl md:text-2xl font-semibold text-neutral-800">AI Feedback & Skill Gaps</h3>
    <ul className="list-disc pl-5 text-neutral-700 space-y-2">
      <li>Actionable AI feedback on your CV (per section)</li>
      <li>Identify missing keywords and skills for roles</li>
      <li>Improve match rate with targeted guidance</li>
    </ul>
  </div>
);

const DecisionsContent = () => (
  <div className="bg-[#dbd6d3] p-8 md:p-14 rounded-3xl space-y-6 border-4 border-black shadow-[8px_8px_0_0_#000]">
    <h3 className="text-xl md:text-2xl font-semibold text-neutral-800">Decision Support</h3>
    <ul className="list-disc pl-5 text-neutral-700 space-y-2">
      <li>Centralize candidate decisions per organization</li>
      <li>Filter by status and export with AI feedback snippets</li>
      <li>Consistent, auditable hiring workflows</li>
    </ul>
  </div>
);

const CompanyPickerContent = () => (
  <div className="bg-[#d8ddd2] p-8 md:p-14 rounded-3xl space-y-6 border-4 border-black shadow-[8px_8px_0_0_#000]">
    <h3 className="text-xl md:text-2xl font-semibold text-neutral-800">Company Picker</h3>
    <ul className="list-disc pl-5 text-neutral-700 space-y-2">
      <li>Public orgs or private access via company code</li>
      <li>Frictionless routing to org-specific portals</li>
      <li>Branded logos and domains per organization</li>
    </ul>
  </div>
);

const SecurityContent = () => (
  <div className="bg-[#d8d5dc] p-8 md:p-14 rounded-3xl space-y-6 border-4 border-black shadow-[8px_8px_0_0_#000]">
    <h3 className="text-xl md:text-2xl font-semibold text-neutral-800">Enterprise Security</h3>
    <ul className="list-disc pl-5 text-neutral-700 space-y-2">
      <li>Per-org isolation with JWT and scoped sessions</li>
      <li>Rate limiting, inactivity timeout, audit logging</li>
      <li>Monthly key rotation with documented procedures</li>
    </ul>
  </div>
);

const data = [
  {
    category: "Submission",
    title: "Upload CV. Instant parsing.",
    bg: "#d5ddd8",
    border: "#111111",
    accent: "#FF6EC7",
    Icon: Upload,
    content: <UploadContent />,
  },
  {
    category: "Builder",
    title: "Craft ATS-ready resumes.",
    bg: "#ddd5d8",
    border: "#111111",
    accent: "#00C2FF",
    Icon: Sparkles,
    content: <BuilderContent />,
  },
  {
    category: "Admin",
    title: "Agentic admin insights.",
    bg: "#d2dbd5",
    border: "#111111",
    accent: "#9B5DE5",
    Icon: Shield,
    content: <AdminContent />,
  },
  {
    category: "Students",
    title: "All submissions in one place.",
    bg: "#d5d8dc",
    border: "#111111",
    accent: "#FF8A00",
    Icon: LayoutDashboard,
    content: <StudentDashboardContent />,
  },
  {
    category: "AI",
    title: "AI feedback & skill gaps.",
    bg: "#e0d6cb",
    border: "#111111",
    accent: "#39FF14",
    Icon: Lightbulb,
    content: <SkillGapContent />,
  },
  {
    category: "Hiring",
    title: "Decision support workflows.",
    bg: "#dbd6d3",
    border: "#111111",
    accent: "#2DE2E6",
    Icon: BarChart3,
    content: <DecisionsContent />,
  },
  {
    category: "Organizations",
    title: "Company picker & private codes.",
    bg: "#d8ddd2",
    border: "#111111",
    accent: "#FF6EC7",
    Icon: Building2,
    content: <CompanyPickerContent />,
  },
  {
    category: "Security",
    title: "Enterprise-grade security.",
    bg: "#d8d5dc",
    border: "#111111",
    accent: "#00C2FF",
    Icon: Lock,
    content: <SecurityContent />,
  },
];
