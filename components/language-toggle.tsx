'use client';

import { useLanguage } from '@/lib/language';
import { Button } from '@/components/ui/button';
import React from 'react';

export default function LanguageToggle() {
  const { lang, setLang, t } = useLanguage();

  return (
    <div
      className="fixed right-4 bottom-4 md:top-20 md:bottom-auto md:right-4"
      style={{ zIndex: 10000 }}
      aria-label="language-toggle"
    >
      <div className="inline-flex items-center gap-0.5 rounded-xl border-[2px] border-black bg-white px-0.5 py-0.5 shadow-[4px_4px_0_#111]">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={`h-7 px-2.5 text-xs rounded-lg border-[1.5px] ${lang === 'en' ? 'bg-black text-white border-black hover:bg-black' : 'bg-white text-black border-transparent hover:bg-neutral-100'}`}
          onClick={() => setLang('en')}
          aria-pressed={lang === 'en'}
        >
          {t('lang_en')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={`h-7 px-2.5 text-xs rounded-lg border-[1.5px] ${lang === 'ar' ? 'bg-black text-white border-black hover:bg-black' : 'bg-white text-black border-transparent hover:bg-neutral-100'}`}
          onClick={() => setLang('ar')}
          aria-pressed={lang === 'ar'}
        >
          {t('lang_ar')}
        </Button>
      </div>
    </div>
  );
}
