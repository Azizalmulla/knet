'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function QRCard({ targetPath = '/start', fallbackImageSrc }: { targetPath?: string; fallbackImageSrc?: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const makeQR = async () => {
      try {
        const url = `${window.location.origin}${targetPath}`;
        const qr = await QRCode.toDataURL(url, { width: 512, margin: 1, color: { dark: '#000000', light: '#ffffff' } });
        setDataUrl(qr);
      } catch (e) {
        console.error('QR generation failed', e);
      }
    };
    makeQR();
  }, [targetPath]);

  if (fallbackImageSrc) {
    return (
      <img
        src={fallbackImageSrc}
        alt="Scan QR to begin"
        className="rounded-xl border border-gray-200 shadow-lg bg-white"
      />
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-xl bg-white p-4 flex items-center justify-center">
      {dataUrl ? (
        <img src={dataUrl} alt="Scan QR to begin" className="w-full h-auto" />)
        : (
        <div className="w-64 h-64 bg-gray-100 animate-pulse rounded-xl" />
      )}
    </div>
  );
}
