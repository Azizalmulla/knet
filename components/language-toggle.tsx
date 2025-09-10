'use client';

import { useLanguage } from '@/lib/language';
import { Button } from '@/components/ui/button';
import React from 'react';

export default function LanguageToggle() {
  const { lang, setLang, t } = useLanguage();

  return (
    <div
      style={{ position: 'fixed', top: 16, right: 16, zIndex: 10000 }}
      aria-label="language-toggle"
    >
      <div className="inline-flex items-center rounded-full border bg-white/90 backdrop-blur px-1 py-1 shadow-sm">
        <Button
          type="button"
          size="sm"
          variant={lang === 'en' ? 'default' : 'ghost'}
          className="rounded-full px-3 h-8"
          onClick={() => setLang('en')}
          aria-pressed={lang === 'en'}
        >
          {t('lang_en')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={lang === 'ar' ? 'default' : 'ghost'}
          className="rounded-full px-3 h-8"
          onClick={() => setLang('ar')}
          aria-pressed={lang === 'ar'}
        >
          {t('lang_ar')}
        </Button>
      </div>
    </div>
  );
}
