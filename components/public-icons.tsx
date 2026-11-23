import { Cloud, LockKeyhole, Network, ShieldCheck, Workflow } from 'lucide-react';
import type { CapabilityIconName, SocialPlatform } from '@/lib/site-config';

/** Decorative, code-native marks. They do not represent a partnership or certification. */
export function SocialIcon({ platform, size = 22 }: { platform: SocialPlatform; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    {platform === 'facebook' && <path d="M14 22v-9h3l.5-3.5H14V7.7c0-1 .3-1.7 1.8-1.7H18V2.8A25 25 0 0 0 14.8 2C11.6 2 9.5 4 9.5 7.4v2.1H6.3V13h3.2v9H14Z"/>}
    {platform === 'instagram' && <><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.9"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.9"/><circle cx="17.5" cy="6.5" r="1.2"/></>}
    {platform === 'tiktok' && <path d="M14 2h3.2c.3 2.4 1.5 3.9 4 4.5v3.3a9 9 0 0 1-4-1.3V16a6 6 0 1 1-6.8-5.9v3.4a2.7 2.7 0 1 0 3.6 2.5V2Z"/>}
    {platform === 'linkedin' && <><circle cx="4.4" cy="4.4" r="2"/><path d="M2.7 8h3.4v13.3H2.7V8Zm6 0H12v1.8h.1c.7-1.3 1.9-2.1 3.9-2.1 4.1 0 4.8 2.6 4.8 6v7.6h-3.5v-6.7c0-1.6 0-3.7-2.2-3.7s-2.5 1.7-2.5 3.6v6.8H8.7V8Z"/></>}
    {platform === 'youtube' && <><rect x="1.5" y="4.5" width="21" height="15" rx="4.5" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="m10 8 6 4-6 4V8Z"/></>}
  </svg>;
}

export function CapabilityIcon({ icon, size = 30 }: { icon: CapabilityIconName; size?: number }) {
  const props = { size, strokeWidth: 1.55, 'aria-hidden': true as const };
  if (icon === 'microsoft') return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" strokeWidth="1.5" d="M2 2h8v8H2zM14 2h8v8h-8zM2 14h8v8H2zM14 14h8v8h-8z"/></svg>;
  if (icon === 'network') return <Network {...props}/>;
  if (icon === 'workflow') return <Workflow {...props}/>;
  if (icon === 'shield') return <ShieldCheck {...props}/>;
  if (icon === 'identity') return <LockKeyhole {...props}/>;
  if (icon === 'splunk') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m5 5 9 7-9 7M15 19h5"/></svg>;
  return <span className="nw-cloud-security-icon" aria-hidden="true"><Cloud {...props}/><ShieldCheck size={Math.round(size * .52)} strokeWidth={1.9}/></span>;
}
