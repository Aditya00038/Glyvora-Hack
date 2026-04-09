'use client';

/**
 * Programmatically triggers the Google Translate engine to switch languages.
 * @param lang The language code (e.g., 'en', 'hi', 'mr')
 */
export const triggerTranslation = (lang: string) => {
  const select = document.querySelector('.goog-te-combo') as HTMLSelectElement;

  if (!select) {
    console.warn("Google Translate engine not loaded yet. Retrying in 500ms...");
    setTimeout(() => triggerTranslation(lang), 500);
    return;
  }

  select.value = lang;
  select.dispatchEvent(new Event('change'));
};
