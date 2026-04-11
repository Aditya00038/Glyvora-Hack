'use client';

import { useEffect } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    google: any;
    googleTranslateElementInit: () => void;
  }
}

export function GoogleTranslate() {
  useEffect(() => {
    window.googleTranslateElementInit = () => {
      new window.google.translate.TranslateElement(
        {
          pageLanguage: 'en',
          autoDisplay: false,
          includedLanguages: 'en,hi,mr,gu,ta,te,kn,ml,bn,pa,ur,or',
        },
        'google_translate_element'
      );
      
      // Auto-translate to user's preferred language (Marathi requested)
      setTimeout(() => {
        const select = document.querySelector('.goog-te-combo') as HTMLSelectElement;
        if (select) {
          const pref = localStorage.getItem('preferredLang') || 'mr';
          if (pref !== 'en') {
            select.value = pref;
            select.dispatchEvent(new Event('change'));
          }
        }
      }, 1000); // Give the widget time to render
    };
  }, []);

  return (
    <>
      <div id="google_translate_element" style={{ display: 'none', position: 'absolute', top: '-9999px' }} />
      <Script
        src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        strategy="afterInteractive"
      />
    </>
  );
}
