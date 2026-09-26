'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { LuxuryMark } from "@/components/luxury-mark"

interface PriceListDisplayProps {
  initialImageUrl: string | null;
}

export function PriceListDisplay({ initialImageUrl }: PriceListDisplayProps) {
  const [imageReady, setImageReady] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)

  const handleDownload = () => {
    if (!initialImageUrl) return
    const link = document.createElement("a")
    link.href = initialImageUrl
    link.download = "Lauryn-Luxe-Beauty-Price-List.png"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col items-center">
      <div className="relative w-full max-w-lg mb-8">
        {!initialImageUrl || imageFailed ? (
          <p className="py-16 text-center text-[11px] font-light uppercase tracking-[0.28em] text-stone-400">
            The price list will be posted here.
          </p>
        ) : (
          <>
            {!imageReady && <LuxuryMark />}
            <img
              ref={(node) => {
                if (node?.complete && node.naturalWidth > 0) setImageReady(true)
              }}
              src={initialImageUrl}
              alt="Lauryn Luxe Beauty Price List"
              className={
                imageReady
                  ? "rounded-lg shadow-lg object-contain w-full h-auto"
                  : "absolute h-px w-px opacity-0"
              }
              onLoad={() => setImageReady(true)}
              onError={() => setImageFailed(true)}
            />
          </>
        )}
      </div>
      <Button onClick={handleDownload} disabled={!initialImageUrl || !imageReady}>
        <Download className="mr-2 h-4 w-4" />
        Download Price List
      </Button>
    </div>
  )
}
