import Image from "next/image"

export const Logo = ({ className }: { className?: string }) => {
  return <Image src="/images/logo.png" alt="Company Logo" width={208} height={59} className={className} />
}
