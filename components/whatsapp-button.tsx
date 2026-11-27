import { siteConfig, type PublicLanguage } from '@/lib/site-config';
import styles from './whatsapp-button.module.css';

/** Uses the existing public company number; no external widget or tracking code. */
export default function WhatsAppButton({ language = 'en' }: { language?: PublicLanguage }) {
  const number = /^tel:\+([1-9]\d{6,14})$/.exec(siteConfig.phoneHref)?.[1];
  if (!number) return null;

  const label = language === 'ar'
    ? 'تواصل مع NorthWallEg على واتساب (يفتح في علامة تبويب جديدة)'
    : 'Chat with NorthWallEg on WhatsApp (opens in a new tab)';

  return (
    <a
      className={styles.button}
      href={`https://wa.me/${number}`}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      aria-label={label}
      title={language === 'ar' ? 'تواصل معنا على واتساب' : 'Chat with us on WhatsApp'}
    >
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
        <path d="M16 4a12 12 0 0 0-10.4 18L4 28l6.2-1.6A12 12 0 1 0 16 4Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/>
        <path d="M11.4 9.5c-.3-.7-.6-.7-1-.7h-.8c-.4 0-.8.2-1 .6-.5.6-1.3 1.5-1.3 3.3 0 1.7 1.2 3.4 1.4 3.6.2.3 2.4 3.8 6 5.2 3 1.2 3.6 1 4.3 1 .7-.1 2.2-.9 2.5-1.8.3-.8.3-1.5.2-1.7-.1-.2-.3-.3-.7-.5l-2.5-1.2c-.3-.2-.6-.2-.8.2l-1.2 1.5c-.2.2-.4.3-.8.1a9.6 9.6 0 0 1-2.9-1.8 10.8 10.8 0 0 1-2-2.4c-.2-.3 0-.5.1-.7l.6-.7.4-.7c.1-.2.1-.4 0-.7l-1.1-2.6Z" fill="currentColor"/>
      </svg>
    </a>
  );
}
