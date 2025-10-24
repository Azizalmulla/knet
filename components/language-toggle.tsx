'use client';

import { useLanguage } from '@/lib/language';
import { Button } from '@/components/ui/button';
import React from 'react';

export default function LanguageToggle() {
  const { lang, setLang, t } = useLanguage();

  return (
    <div
      className="fixed right-3 bottom-3 md:top-4 md:bottom-auto md:right-4"
      style={{ zIndex: 10000 }}
      aria-label="language-toggle"
    >
      <div className="inline-flex items-center gap-1 rounded-2xl border-[3px] border-black bg-white px-1 py-1 shadow-[6px_6px_0_#111]">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={`h-8 px-3 rounded-xl border-[2px] ${lang === 'en' ? 'bg-black text-white border-black hover:bg-black' : 'bg-white text-black border-black hover:bg-neutral-100'}`}
          onClick={() => setLang('en')}
          aria-pressed={lang === 'en'}
        >
          {t('lang_en')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={`h-8 px-3 rounded-xl border-[2px] ${lang === 'ar' ? 'bg-black text-white border-black hover:bg-black' : 'bg-white text-black border-black hover:bg-neutral-100'}`}
          onClick={() => setLang('ar')}
          aria-pressed={lang === 'ar'}
        >
          {t('lang_ar')}
        </Button>
      </div>
    </div>
  );
}
