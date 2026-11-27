import { readMarketingConfig } from './policy.mjs';
import { insightGuides } from '@/lib/insights-content';
import campaigns from './campaigns.json';

// These are public IDs, not access tokens. Next.js embeds them at build time.
// Keep static process.env access so the server and browser use the same build.
export const marketingConfig = readMarketingConfig({
  NEXT_PUBLIC_MARKETING_ENABLED: process.env.NEXT_PUBLIC_MARKETING_ENABLED,
  NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID,
  NEXT_PUBLIC_TIKTOK_PIXEL_ID: process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID,
  NEXT_PUBLIC_META_MANUAL_MODE_CONFIRMED: process.env.NEXT_PUBLIC_META_MANUAL_MODE_CONFIRMED,
  NEXT_PUBLIC_TIKTOK_MANUAL_MODE_CONFIRMED: process.env.NEXT_PUBLIC_TIKTOK_MANUAL_MODE_CONFIRMED,
});
export const marketingGuideSlugs = insightGuides.map(guide => guide.slug);
export const marketingCampaigns = campaigns.campaignCodes;
