import { useI18n } from '@/contexts/I18nContext';

export function LangToggle() {
  const { lang, toggleLang } = useI18n();
  return (
    <button
      onClick={toggleLang}
      className="fixed top-3 right-3 z-50 flex items-center gap-1 rounded-full bg-card border border-border px-3 py-1.5 text-xs font-display font-semibold text-muted-foreground hover:text-foreground transition-colors"
    >
      <span className={lang === 'en' ? 'text-primary' : ''}>EN</span>
      <span>/</span>
      <span className={lang === 'fr' ? 'text-primary' : ''}>FR</span>
    </button>
  );
}
