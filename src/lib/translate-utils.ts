'use client';

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
