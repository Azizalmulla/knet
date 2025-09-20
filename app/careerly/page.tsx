"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ArrowRight, Shield, Lock, Globe2, Upload, Brain } from "lucide-react"
import careerlyLogo from "../../images/228DB42A-AD28-4586-8E0F-5CEE125B7D99.PNG"
import heroCard from "../../images/2C1A30C8-E9BD-4318-A653-F58433B32A20.PNG"

export default function CareerlyLanding() {
  const enterApp = useCallback((href: string = "/") => {
    try {
      // Mark landing as seen for one year
      document.cookie = `seenCareerlyLanding=1; Path=/; Max-Age=${60 * 60 * 24 * 365}`
    } catch {}
    window.location.href = href
  }, [])

  // (timeline removed)

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      {/* Ambient gradients */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-gradient-to-br from-zinc-700/30 via-zinc-900/0 to-zinc-900/0 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-gradient-to-br from-emerald-600/25 to-cyan-600/10 blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-black/40 border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src={heroCard}
              alt="Careerly"
              width={40}
              height={40}
              className="h-10 w-10 rounded-lg object-contain"
              priority
            />
            <span className="text-lg font-bold tracking-tight">Careerly</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
            <a href="#contact" className="hover:text-foreground transition-colors">Contact</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="hidden sm:inline-flex text-zinc-200 hover:text-white" onClick={() => enterApp("/start")}>Enter App</Button>
            <Button variant="outline" className="rounded-2xl px-5 bg-white text-black border-white hover:bg-white/90" onClick={() => enterApp("/careerly/admin/login")}>Admin Login</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 py-16 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="mt-5 text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
              Land your next role.
              <br className="hidden sm:block" /> Smarter. Faster. Careerly.
            </h1>
            <p className="mt-5 max-w-xl text-zinc-400">
              Careerly brings a modern, privacy-first experience to CV building and submission. Powered by AI parsing, 
              Watheefti taxonomy, and a multi-tenant architecture built for scale.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                size="lg"
                className="rounded-2xl px-6 bg-white text-black hover:bg-zinc-100"
                onClick={() => enterApp("/upload")}
              >
                Upload CV (PDF)
              </Button>
              <Button
                size="lg"
                className="rounded-2xl px-6 bg-white text-black hover:bg-zinc-100"
                onClick={() => enterApp("/ai-builder")}
              >
                Try AI CV Builder
              </Button>
            </div>
            <div className="mt-6 flex items-center gap-6 text-sm text-zinc-400">
              <div className="flex items-center gap-2"><Shield className="h-4 w-4" /> Privacy-first</div>
              <div className="flex items-center gap-2"><Globe2 className="h-4 w-4" /> Bilingual-ready</div>
              <div className="flex items-center gap-2"><Lock className="h-4 w-4" /> Secure storage</div>
            </div>
          </div>
          <div className="relative">
            <div className="relative w-full h-[320px] md:h-[380px]">
              <Image
                src={careerlyLogo}
                alt="Careerly Hero"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover rounded-3xl"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      

      

      

      {/* Feature Cards */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 justify-items-center">
          {/* Upload CV Card */}
          <div className="feature-container group">
            <div 
              className="feature-card w-80 h-80 relative rounded-[2.5em] p-8 transition-transform duration-400 ease-in-out hover:scale-[0.97] active:scale-90"
              style={{ backgroundColor: '#b39eb5' }}
            >
              <div className="card-content flex flex-col justify-between gap-20 h-full transition-transform duration-400 ease-in-out hover:scale-[0.96]">
                <div className="card-top flex justify-between">
                  <div>
                    <h3 className="card-title font-bold text-black text-xl mb-2">Upload CV</h3>
                    <p className="font-semibold text-black text-sm">Quick & Secure</p>
                  </div>
                </div>
                <div className="card-bottom flex justify-between items-end">
                  <p className="font-semibold text-black text-sm">PDF Only</p>
                  <p className="font-semibold text-black text-lg">10MB Max</p>
                </div>
              </div>
              <div className="card-image absolute w-full h-full top-0 left-0 grid place-items-center pointer-events-none">
                <Upload className="w-16 h-16 text-black transition-transform duration-400 ease-in-out hover:scale-105" />
              </div>
              
              {/* Decorative Arrow */}
              <div className="arrow-container absolute -bottom-16 left-1/2 transform -translate-x-1/2 w-24 h-16 group-hover:opacity-100 transition-all duration-500">
                <div className="arrow-body"></div>
              </div>
            </div>
            
            {/* Additional Information */}
            <div className="mt-16 text-center">
              <h4 className="text-lg font-semibold text-white mb-2">Instant Processing</h4>
              <p className="text-zinc-400 text-sm max-w-64">
                Upload your existing CV and get immediate AI-powered parsing with structured data extraction
              </p>
            </div>
          </div>

          {/* AI CV Builder Card */}
          <div className="feature-container group">
            <div 
              className="feature-card w-80 h-80 relative rounded-[2.5em] p-8 transition-transform duration-400 ease-in-out hover:scale-[0.97] active:scale-90"
              style={{ backgroundColor: '#d8c29d' }}
            >
              <div className="card-content flex flex-col justify-between gap-20 h-full transition-transform duration-400 ease-in-out hover:scale-[0.96]">
                <div className="card-top flex justify-between">
                  <div>
                    <h3 className="card-title font-bold text-black text-xl mb-2">AI CV Builder</h3>
                    <p className="font-semibold text-black text-sm">Smart & Modern</p>
                  </div>
                </div>
                <div className="card-bottom flex justify-between items-end">
                  <p className="font-semibold text-black text-sm">ATS-Friendly</p>
                  <p className="font-semibold text-black text-lg">AI Powered</p>
                </div>
              </div>
              <div className="card-image absolute w-full h-full top-0 left-0 grid place-items-center pointer-events-none">
                <Brain className="w-16 h-16 text-black transition-transform duration-400 ease-in-out hover:scale-105" />
              </div>
              
              {/* Decorative Arrow */}
              <div className="arrow-container absolute -bottom-16 left-1/2 transform -translate-x-1/2 w-24 h-16 group-hover:opacity-100 transition-all duration-500">
                <div className="arrow-body arrow-body-2"></div>
              </div>
            </div>
            
            {/* Additional Information */}
            <div className="mt-16 text-center">
              <h4 className="text-lg font-semibold text-white mb-2">Guided Creation</h4>
              <p className="text-zinc-400 text-sm max-w-64">
                Build from scratch with our intelligent wizard featuring step-by-step guidance and real-time optimization
              </p>
            </div>
          </div>

          {/* Admin Dashboard Card */}
          <div className="feature-container group">
            <div 
              className="feature-card w-80 h-80 relative rounded-[2.5em] p-8 transition-transform duration-400 ease-in-out hover:scale-[0.97] active:scale-90"
              style={{ backgroundColor: '#8a9e79' }}
            >
              <div className="card-content flex flex-col justify-between gap-20 h-full transition-transform duration-400 ease-in-out hover:scale-[0.96]">
                <div className="card-top flex justify-between">
                  <div>
                    <h3 className="card-title font-bold text-black text-xl mb-2">Agentic Admin Panel</h3>
                    <p className="font-semibold text-black text-sm">Manage & Review</p>
                  </div>
                </div>
                <div className="card-bottom flex justify-between items-end">
                  <p className="font-semibold text-black text-sm">Secure Access</p>
                  <p className="font-semibold text-black text-lg">Analytics</p>
                </div>
              </div>
              <div className="card-image absolute w-full h-full top-0 left-0 grid place-items-center pointer-events-none">
                <Shield className="w-16 h-16 text-black transition-transform duration-400 ease-in-out hover:scale-105" />
              </div>
              
              {/* Decorative Arrow */}
              <div className="arrow-container absolute -bottom-16 left-1/2 transform -translate-x-1/2 w-24 h-16 group-hover:opacity-100 transition-all duration-500">
                <div className="arrow-body arrow-body-3"></div>
              </div>
            </div>
            
            {/* Additional Information */}
            <div className="mt-16 text-center">
              <h4 className="text-lg font-semibold text-white mb-2">AI-Powered Insights</h4>
              <p className="text-zinc-400 text-sm max-w-64">
                Advanced candidate screening with natural language queries and intelligent matching algorithms
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* Custom CSS for Curved Dashed Arrows */}
      <style jsx>{`
        .arrow-container {
          --highlight-color: #ff7473;
        }

        .arrow-body {
          width: 100%;
          height: 95%;
          margin-left: 11px;
          border-width: 3px 0 0 3px;
          border-style: dashed;
          border-color: var(--highlight-color);
          border-top-left-radius: 100%;
          opacity: 0.7;
          transition: all 0.3s ease;
        }

        .arrow-body::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          border-width: 15px 12px 0;
          border-style: solid;
          border-color: var(--highlight-color) transparent transparent;
        }

        .arrow-body-2 {
          --highlight-color: #06b6d4;
        }

        .arrow-body-3 {
          --highlight-color: #8b5cf6;
        }

        .group:hover .arrow-body {
          opacity: 1;
          filter: drop-shadow(0 0 8px var(--highlight-color));
        }

        @media (max-width: 768px) {
          .feature-container {
            margin-bottom: 4rem;
          }
          
          .arrow-container {
            width: 20px;
            height: 12px;
          }

        }
      `}</style>

      {/* Footer */}
      <footer id="contact" className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Image src={careerlyLogo} alt="Careerly" width={20} height={20} className="h-5 w-5 rounded" />
            <span>© {new Date().getFullYear()} Careerly</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/upload" className="hover:text-foreground transition-colors">Upload</Link>
            <Link href="/ai-builder" className="hover:text-foreground transition-colors">AI Builder</Link>
            <Link href="/admin/login" className="hover:text-foreground transition-colors">Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

 
