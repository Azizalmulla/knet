import Image from "next/image"
import Link from "next/link"
import QRCard from "@/components/qr-card"

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-zinc-900 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-5xl rounded-[24px] bg-white/5 backdrop-blur border border-white/10 shadow-2xl overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Left: QR */}
          <div className="p-6 md:p-8 lg:p-10 bg-white">
            <div className="rounded-2xl overflow-hidden border border-zinc-200 shadow-xl">
              <QRCard targetPath="/start" />
            </div>
          </div>

          {/* Right: Content with KNET logo top-right */}
          <div className="relative p-6 md:p-8 lg:p-10 bg-white">
            <div className="absolute right-6 top-6">
              <Image
                src="/images/logo.png"
                alt="KNET"
                width={96}
                height={24}
                className="h-8 w-auto object-contain"
                priority
              />
            </div>

            <div className="mt-12 md:mt-4 flex flex-col h-full">
              <div className="space-y-3">
                <h1 className="text-2xl md:text-3xl font-semibold text-zinc-900">Start your KNET CV journey</h1>
                <p className="text-zinc-600">Scan the QR code to open the student dashboard, or click the button below to begin on this device.</p>
              </div>

              <div className="mt-8">
                <Link
                  href="/start"
                  className="inline-flex items-center justify-center rounded-xl bg-black text-white px-6 py-3 text-sm font-medium shadow hover:bg-zinc-800 transition"
                >
                  Open Dashboard
                </Link>
                <p className="mt-3 text-xs text-zinc-500">The QR directs to the same destination.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
