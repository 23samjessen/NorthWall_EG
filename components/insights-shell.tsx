import { Brand } from './brand';
import WhatsAppButton from './whatsapp-button';
import MarketingConsent from './marketing-consent';
import { siteConfig } from '@/lib/site-config';
import './insights.css';

export default function InsightsShell({ children }: { children: React.ReactNode }) {
  return <div className="nw-insights">
    <a className="nw-insights-skip" href="#insights-main">Skip to content</a>
    {siteConfig.isReviewDemo && <div className="nw-insights-review">Private review · preparing NorthWallEg for launch</div>}
    <header className="nw-insights-header"><Brand/><nav aria-label="Insights navigation"><a href="/#expertise">Services</a><a href="/insights">Security insights</a><a href="/#contact">Contact</a><a className="nw-insights-workspace" href="/workspace">Employee workspace</a></nav></header>
    <main id="insights-main">{children}</main>
    <footer className="nw-insights-footer"><div><Brand light/><p>IT. Security. People. A clearer way forward.</p></div><nav aria-label="Insights footer"><a href="/insights">News & guides</a><a href="/en/services/microsoft-365">Microsoft 365</a><a href="/en/services/cyber-defense">Cyber defence</a><a href="/#contact">Talk to the team</a></nav><p>© {new Date().getFullYear()} NorthWallEg. Service scope, licensing and response arrangements are agreed for each engagement.</p></footer>
    <MarketingConsent/>
    <WhatsAppButton/>
  </div>;
}
