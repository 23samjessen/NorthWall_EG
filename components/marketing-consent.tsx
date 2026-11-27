'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Cookie, Download, ExternalLink, LockKeyhole, X } from 'lucide-react';
import {
  COOKIE_SETTINGS_EVENT,
  exportConsentReceipt,
  getMarketingSnapshot,
  saveMarketingConsent,
  startMarketing,
} from '@/lib/marketing/runtime';
import styles from './marketing-consent.module.css';

type Choices = { meta: boolean; tiktok: boolean };
type Snapshot = {
  ready: boolean;
  hasDecision: boolean;
  choices: Choices;
  available: Choices;
  privacySignal: boolean;
  storageAvailable: boolean;
  expiresAt: number | null;
};

const EMPTY: Snapshot = {
  ready: false,
  hasDecision: false,
  choices: { meta: false, tiktok: false },
  available: { meta: false, tiktok: false },
  privacySignal: false,
  storageAvailable: true,
  expiresAt: null,
};

/** Public-page preferences only. The runtime owns consent storage and provider loading. */
export default function MarketingConsent({ language = 'en' }: { language?: 'en' | 'ar' }) {
  const ar = language === 'ar';
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const id = useId();
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [draft, setDraft] = useState<Choices>({ meta: false, tiktok: false });
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const accessButtonRef = useRef<HTMLButtonElement>(null);
  const bannerSettingsRef = useRef<HTMLButtonElement>(null);
  const hasPartners = snapshot.available.meta || snapshot.available.tiktok;
  const partners = [
    snapshot.available.meta ? t('Meta (Facebook and Instagram)', 'Meta (فيسبوك وإنستغرام)') : '',
    snapshot.available.tiktok ? 'TikTok' : '',
  ].filter(Boolean).join(t(' and ', ' و'));

  useEffect(() => {
    let active = true;
    const update = () => {
      if (!active) return;
      const next = getMarketingSnapshot();
      setSnapshot({ ...next, choices: { ...next.choices }, available: { ...next.available } });
    };
    const stop = startMarketing(update);
    update();
    return () => { active = false; stop(); };
  }, []);

  const openSettings = useCallback(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const current = getMarketingSnapshot();
    setDraft({
      meta: current.available.meta && current.choices.meta && !current.privacySignal,
      tiktok: current.available.tiktok && current.choices.tiktok && !current.privacySignal,
    });
    setError('');
    setOpened(true);
  }, []);

  useEffect(() => {
    document.addEventListener(COOKIE_SETTINGS_EVENT, openSettings);
    return () => document.removeEventListener(COOKIE_SETTINGS_EVENT, openSettings);
  }, [openSettings]);

  useEffect(() => {
    if (snapshot.privacySignal) setDraft({ meta: false, tiktok: false });
  }, [snapshot.privacySignal]);

  useEffect(() => {
    if (!opened) return;
    const dialog = dialogRef.current;
    const previousFocus = openerRef.current;
    const previousOverflow = document.body.style.overflow;
    if (dialog && !dialog.open) dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      if (dialog?.open) dialog.close();
      document.body.style.overflow = document.querySelector('dialog[open]') ? 'hidden' : previousOverflow;
      queueMicrotask(() => {
        if (document.querySelector('dialog[open]')) return;
        const target = previousFocus?.isConnected ? previousFocus : bannerSettingsRef.current || accessButtonRef.current;
        target?.focus({ preventScroll: true });
      });
    };
  }, [opened]);

  function save(choices: Choices) {
    setError('');
    const next = {
      meta: Boolean(choices.meta && snapshot.available.meta && !snapshot.privacySignal),
      tiktok: Boolean(choices.tiktok && snapshot.available.tiktok && !snapshot.privacySignal),
    };
    try {
      if (saveMarketingConsent(next).saved) return;
    } catch {
      // Keep the controls usable without displaying internal storage details.
    }
    setError(t(
      'Your browser could not save this choice. Please check its storage settings and try again.',
      'تعذّر حفظ اختيارك في المتصفح. يُرجى مراجعة إعدادات التخزين والمحاولة مرة أخرى.',
    ));
  }

  function downloadChoice() {
    const receipt = exportConsentReceipt();
    if (!receipt) {
      setError(t('There is no saved choice to download yet.', 'لا يوجد اختيار محفوظ لتنزيله بعد.'));
      return;
    }
    const url = URL.createObjectURL(new Blob([receipt], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'NorthWallEg-cookie-choices.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const signalNotice = t(
    'Your browser has requested privacy protection. Optional marketing is kept off while that signal is enabled.',
    'طلب متصفحك حماية الخصوصية. يبقى التسويق الاختياري متوقفاً ما دامت هذه الإشارة مفعّلة.',
  );

  return (
    <div className={styles.root} lang={language} dir={ar ? 'rtl' : 'ltr'}>
      <div className={styles.access}>
        <button ref={accessButtonRef} type="button" className={styles.settingsLink} onClick={openSettings} disabled={!snapshot.ready} aria-haspopup="dialog">
          <Cookie size={16} aria-hidden="true"/>
          {t('Cookie settings', 'إعدادات ملفات الارتباط')}
        </button>
      </div>

      {snapshot.ready && !snapshot.hasDecision && hasPartners && !opened && (
        <section className={styles.banner} role="region" aria-labelledby={`${id}-banner-title`}>
          <div className={styles.bannerHeading}>
            <span className={styles.cookieMark}><Cookie size={23} strokeWidth={1.5} aria-hidden="true"/></span>
            <h2 id={`${id}-banner-title`}>{t('Your privacy, your choice', 'خصوصيتك، اختيارك')}</h2>
          </div>
          <p>{t(
            `NorthWallEg uses necessary storage to keep this website working. With your permission, ${partners} may receive page and service interactions, browser/device information, IP addresses and advertising identifiers to measure our ads and show you relevant NorthWallEg advertising.`,
            `تستخدم NorthWallEg التخزين الضروري لتشغيل هذا الموقع. بعد موافقتك، قد تتلقى ${partners} معلومات عن الصفحات والخدمات التي تتفاعل معها، والمتصفح والجهاز وعنوان IP ومعرّفات الإعلانات، لقياس إعلاناتنا وعرض إعلانات NorthWallEg المناسبة لك.`,
          )}</p>
          <p className={styles.small}>{t(
            'Optional marketing starts only after you agree. You can change or withdraw your choice anytime in Cookie settings.',
            'لا يبدأ التسويق الاختياري إلا بعد موافقتك. يمكنك تغيير اختيارك أو سحب موافقتك في أي وقت من إعدادات ملفات الارتباط.',
          )}</p>
          {snapshot.privacySignal && <p className={styles.notice}>{signalNotice}</p>}
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <div className={styles.bannerActions}>
            <button type="button" className={styles.button} onClick={() => save({ meta: false, tiktok: false })}>{t('Reject optional', 'رفض الاختياري')}</button>
            <button type="button" className={styles.button} onClick={() => save(snapshot.available)} disabled={snapshot.privacySignal}>{t('Accept all', 'قبول الكل')}</button>
            <button ref={bannerSettingsRef} type="button" className={styles.button} onClick={openSettings} aria-haspopup="dialog">{t('Settings', 'الإعدادات')}</button>
          </div>
          <p className={styles.refreshNote}>{t('Saving refreshes this page.', 'يتم تحديث الصفحة عند حفظ اختيارك.')}</p>
        </section>
      )}

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={`${id}-dialog-title`}
        aria-describedby={`${id}-dialog-intro`}
        onCancel={event => { event.preventDefault(); setOpened(false); }}
        onClose={() => setOpened(false)}
      >
        <div className={styles.dialogHead}>
          <div>
            <span className={styles.eyebrow}>NorthWallEg</span>
            <h2 id={`${id}-dialog-title`}>{t('Cookie preferences', 'تفضيلات ملفات الارتباط')}</h2>
          </div>
          <button type="button" className={styles.close} onClick={() => setOpened(false)} aria-label={t('Close cookie settings', 'إغلاق إعدادات ملفات الارتباط')}>
            <X size={22} aria-hidden="true"/>
          </button>
        </div>

        <div className={styles.dialogBody}>
          <p id={`${id}-dialog-intro`}>{hasPartners ? t(
            'Choose which marketing partners may receive information about your visit. Rejecting optional cookies will not prevent you from using the website or contacting us.',
            'اختر شركاء التسويق الذين تسمح لهم بتلقي معلومات عن زيارتك. رفض ملفات الارتباط الاختيارية لا يمنعك من استخدام الموقع أو التواصل معنا.',
          ) : t(
            'Only necessary storage is active on this website. If we add optional marketing tools, we will ask for your choice before using them.',
            'التخزين الضروري فقط هو المفعّل على هذا الموقع. إذا أضفنا أدوات تسويق اختيارية، سنطلب اختيارك قبل استخدامها.',
          )}</p>

          <section className={styles.category} aria-labelledby={`${id}-necessary-title`}>
            <div className={styles.categoryHead}>
              <h3 id={`${id}-necessary-title`}><LockKeyhole size={17} aria-hidden="true"/>{t('Necessary', 'ضروري')}</h3>
              <span className={styles.alwaysOn}>{t('Always active', 'مفعّل دائماً')}</span>
            </div>
            <p>{t(
              'Supports security and employee sign-in and remembers your cookie choices for up to 180 days. Your selected website appearance is also saved when you choose a design.',
              'يدعم الأمان وتسجيل دخول الموظفين ويحفظ اختيارات ملفات الارتباط لمدة تصل إلى 180 يوماً. ويُحفظ أيضاً المظهر الذي تختاره للموقع عند تغيير التصميم.',
            )}</p>
          </section>

          {snapshot.privacySignal && <p className={styles.notice} role="status">{signalNotice}</p>}

          {snapshot.available.meta && (
            <section className={styles.category} aria-labelledby={`${id}-meta-title`}>
              <div className={styles.categoryHead}>
                <h3 id={`${id}-meta-title`}><label htmlFor={`${id}-meta`}>Meta · Facebook &amp; Instagram</label></h3>
                <input id={`${id}-meta`} className={styles.switch} type="checkbox" role="switch" checked={draft.meta} disabled={snapshot.privacySignal} onChange={event => setDraft(current => ({ ...current, meta: event.target.checked }))} aria-describedby={`${id}-meta-description`}/>
              </div>
              <p id={`${id}-meta-description`}>{t(
                'Helps measure our Facebook and Instagram campaigns and show NorthWallEg ads to people who have visited our public pages. Meta receives consented advertising events and associated browser, network and advertising identifiers.',
                'يساعد في قياس حملاتنا على فيسبوك وإنستغرام وعرض إعلانات NorthWallEg لأشخاص زاروا صفحاتنا العامة. تتلقى Meta أحداث الإعلانات التي وافقت عليها، ومعلومات المتصفح والشبكة ومعرّفات الإعلانات المرتبطة بها.',
              )}</p>
              <a className={styles.policyLink} href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer">{t('Meta privacy policy', 'سياسة خصوصية Meta')}<ExternalLink size={13} aria-hidden="true"/><span className={styles.visuallyHidden}>{t(' (opens in a new tab)', ' (يفتح في علامة تبويب جديدة)')}</span></a>
            </section>
          )}

          {snapshot.available.tiktok && (
            <section className={styles.category} aria-labelledby={`${id}-tiktok-title`}>
              <div className={styles.categoryHead}>
                <h3 id={`${id}-tiktok-title`}><label htmlFor={`${id}-tiktok`}>TikTok</label></h3>
                <input id={`${id}-tiktok`} className={styles.switch} type="checkbox" role="switch" checked={draft.tiktok} disabled={snapshot.privacySignal} onChange={event => setDraft(current => ({ ...current, tiktok: event.target.checked }))} aria-describedby={`${id}-tiktok-description`}/>
              </div>
              <p id={`${id}-tiktok-description`}>{t(
                'Helps measure our TikTok campaigns and show NorthWallEg ads to people who have visited our public pages. TikTok receives consented advertising events and associated browser, network and advertising identifiers.',
                'يساعد في قياس حملاتنا على TikTok وعرض إعلانات NorthWallEg لأشخاص زاروا صفحاتنا العامة. يتلقى TikTok أحداث الإعلانات التي وافقت عليها، ومعلومات المتصفح والشبكة ومعرّفات الإعلانات المرتبطة بها.',
              )}</p>
              <a className={styles.policyLink} href="https://www.tiktok.com/legal/page/global/privacy-policy/en" target="_blank" rel="noopener noreferrer">{t('TikTok privacy policy', 'سياسة خصوصية TikTok')}<ExternalLink size={13} aria-hidden="true"/><span className={styles.visuallyHidden}>{t(' (opens in a new tab)', ' (يفتح في علامة تبويب جديدة)')}</span></a>
            </section>
          )}

          <details className={styles.details}>
            <summary>{t('How your information is used', 'كيف تُستخدم معلوماتك')}</summary>
            <div>
              <h3>{t('Public website activity', 'نشاط الموقع العام')}</h3>
              <p>{t(
                'Optional advertising measurement covers public page views, selected services, brief downloads and contact clicks. A contact click is not proof of a message, enquiry or purchase. Names, email addresses, telephone numbers and message text are not included in the events we manually send.',
                'يشمل قياس الإعلانات الاختياري زيارات الصفحات العامة والخدمات المختارة وتنزيل الملخصات والنقر على وسائل التواصل. النقر لا يعني إرسال رسالة أو طلب أو إتمام عملية شراء. لا تتضمن الأحداث التي نرسلها يدوياً الأسماء أو عناوين البريد الإلكتروني أو أرقام الهاتف أو نصوص الرسائل.',
              )}</p>
              <p>{t(
                'Employee sign-in, the workspace, internal chat and tickets are excluded from advertising tracking.',
                'تسجيل دخول الموظفين ومساحة العمل والمحادثات والتذاكر الداخلية مستثناة من التتبّع الإعلاني.',
              )}</p>
              <h3>{t('Storage and sharing', 'التخزين والمشاركة')}</h3>
              <ul className={styles.cookieList}>
                <li>
                  <code dir="ltr">__Host-nw_marketing</code>{t(
                    ': our necessary consent cookie remembers your choices for up to 180 days.',
                    ': ملف ارتباط ضروري خاص بالموقع يحفظ اختياراتك لمدة تصل إلى 180 يوماً.',
                  )}
                </li>
                {hasPartners && <li>
                  <code dir="ltr">__Host-nw_campaign</code>{t(
                    ': our optional campaign cookie keeps limited campaign attribution for up to 30 days, only after marketing consent.',
                    ': ملف اختياري خاص بالموقع يحفظ معلومات محدودة عن مصدر الحملة لمدة تصل إلى 30 يوماً، بعد الموافقة على التسويق فقط.',
                  )}
                </li>}
                {snapshot.available.meta && <li>
                  <span dir="ltr">Meta: <code>_fbp</code> / <code>_fbc</code></span>{t(
                    ' typically last up to 90 days and support advertising measurement and attribution after you allow Meta.',
                    ' تستمر عادةً لمدة تصل إلى 90 يوماً وتدعم قياس الإعلانات وتحديد مصدرها بعد السماح لـ Meta.',
                  )}
                </li>}
                {snapshot.available.tiktok && <>
                  <li>
                    <span dir="ltr">TikTok: <code>_ttp</code>, <code>ttcsid</code> / <code>{'ttcsid_<pixel>'}</code></span>{t(
                      ' have published provider defaults of up to 13 months for advertising identifiers and session measurement, after you allow TikTok.',
                      ' لها مدد افتراضية منشورة من المزوّد تصل إلى 13 شهراً لمعرّفات الإعلانات وقياس الجلسات، بعد السماح لـ TikTok.',
                    )}
                  </li>
                  <li>
                    <code dir="ltr">_tt_enable_cookie</code>{t(
                      ': TikTok may also set a cookie availability marker, with a configurable provider default of 390 days (about 13 months).',
                      ': قد يضيف TikTok أيضاً مؤشراً لتوفّر ملفات الارتباط، بمدة افتراضية قابلة للتعديل لدى المزوّد تبلغ 390 يوماً (نحو 13 شهراً).',
                    )}
                  </li>
                  <li>
                    <code dir="ltr">ttclid</code>{t(
                      ': our initial first-party capture of a TikTok ad click identifier expires after 30 days and requires TikTok consent. TikTok’s software may subsequently manage or refresh this identifier according to its own defaults and policy.',
                      ': تنتهي صلاحية الحفظ الأولي لمعرّف النقر على إعلان TikTok بواسطة موقعنا بعد 30 يوماً، ويتطلب موافقتك على TikTok. وقد يدير برنامج TikTok هذا المعرّف أو يجدّده لاحقاً وفقاً لإعداداته الافتراضية وسياسته.',
                    )}
                  </li>
                </>}
              </ul>
              {hasPartners && <p>{t(
                'Partner durations above are published defaults, not a live measurement of cookies on your device. Partners may refresh their cookies according to their policies, and your browser may shorten these periods. Their privacy policies explain their own data retention, international processing and your rights.',
                'المدد المذكورة للشركاء هي مدد افتراضية منشورة، وليست قياساً مباشراً لملفات الارتباط على جهازك. قد يجدّد الشركاء ملفاتهم وفقاً لسياساتهم، وقد يقلّل متصفحك هذه المدد. وتشرح سياسات خصوصيتهم الاحتفاظ ببياناتهم ومعالجتها دولياً وحقوقك.',
              )}</p>}
              <h3>{t('Changing your mind', 'تغيير اختيارك')}</h3>
              <p>{t(
                'Open Cookie settings at any time to withdraw consent. Withdrawal stops new advertising events from this site, clears accessible first-party marketing identifiers and refreshes the page. NorthWallEg cannot clear all third-party cookies on advertising partners’ domains or automatically erase information they already received. You can manage those cookies in your browser and contact the partners about their data using the policies above.',
                'افتح إعدادات ملفات الارتباط في أي وقت لسحب موافقتك. يؤدي السحب إلى إيقاف أحداث الإعلانات الجديدة من الموقع ومسح معرّفات التسويق المحلية التي يمكن الوصول إليها وتحديث الصفحة. لا تستطيع NorthWallEg مسح جميع ملفات الارتباط التابعة لجهات خارجية على نطاقات شركاء الإعلانات أو حذف المعلومات التي تلقّوها سابقاً تلقائياً. يمكنك إدارة تلك الملفات من متصفحك والتواصل مع الشركاء بشأن بياناتهم عبر السياسات أعلاه.',
              )}</p>
              <a className={styles.policyLink} href={ar ? '/ar#contact' : '/#contact'} onClick={() => setOpened(false)}>{t('Contact NorthWallEg about privacy', 'تواصل مع NorthWallEg بشأن الخصوصية')}</a>
            </div>
          </details>

          {snapshot.hasDecision && snapshot.expiresAt && <p className={styles.expiry}>{t('Current choice expires on ', 'ينتهي الاختيار الحالي في ')}{new Date(snapshot.expiresAt).toLocaleDateString(ar ? 'ar-EG' : 'en-GB')}.</p>}
          {!snapshot.storageAvailable && <p className={styles.notice}>{t('This browser is blocking preference storage. Optional marketing remains off.', 'يمنع هذا المتصفح حفظ التفضيلات. يبقى التسويق الاختياري متوقفاً.')}</p>}
          {error && <p role="alert" className={styles.error}>{error}</p>}
        </div>

        <div className={styles.dialogFoot}>
          <div className={styles.dialogActions}>
            <button type="button" className={styles.button} onClick={() => save({ meta: false, tiktok: false })}>{t('Reject optional', 'رفض الاختياري')}</button>
            <button type="button" className={styles.button} onClick={() => save(draft)}>{t('Save preferences', 'حفظ التفضيلات')}</button>
          </div>
          <div className={styles.footNotes}>
            <p>{t('Saving refreshes this page.', 'يتم تحديث الصفحة عند حفظ اختيارك.')}</p>
            {snapshot.hasDecision && <button type="button" className={styles.receiptButton} onClick={downloadChoice}><Download size={14} aria-hidden="true"/>{t('Download my choice', 'تنزيل اختياري')}</button>}
          </div>
        </div>
      </dialog>
    </div>
  );
}
