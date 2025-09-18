import Image from "next/image"
import Link from "next/link"
import QRCard from "@/components/qr-card"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 transition-colors">
      <div className="w-full max-w-5xl rounded-[24px] bg-card border border-border shadow-xl overflow-hidden transition-colors">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Left: QR */}
          <div className="p-6 md:p-8 lg:p-10">
            <div className="rounded-2xl overflow-hidden border border-border shadow">
              <QRCard targetPath="/start" />
            </div>
          </div>

          {/* Right: Content with KNET logo top-right */}
          <div className="relative p-6 md:p-8 lg:p-10">
            <div className="absolute ltr:right-6 rtl:left-6 top-6">
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
                <h1 className="text-2xl md:text-3xl font-semibold">Start your KNET CV journey</h1>
                <p className="text-muted-foreground">Scan the QR code to open the student dashboard, or click the button below to begin on this device.</p>
              </div>

              <div className="mt-8">
                <Button asChild className="rounded-xl">
                  <Link href="/start">Open Dashboard</Link>
                </Button>
                <p className="mt-3 text-xs text-muted-foreground">The QR directs to the same destination.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
