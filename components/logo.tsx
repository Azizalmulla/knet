import Image from "next/image"

export const Logo = ({ className }: { className?: string }) => {
  return <Image src="/placeholder-logo.png" alt="Wathefni AI" width={208} height={59} className={className} />
}
