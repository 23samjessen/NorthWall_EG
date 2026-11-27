'use client';
import { Star } from 'lucide-react';
import { siteConfig, publicText, type PublicLanguage } from '@/lib/site-config';

export default function GoogleReviewsButton({language='en'}:{language?:PublicLanguage}){
 const review=siteConfig.googleReviews;
 if(!review)return null;
 return <a className="nw-google-reviews-float" href={review.href} target="_blank" rel="noopener noreferrer" aria-label={publicText(review.label,language)} title={publicText(review.label,language)}><Star size={20} aria-hidden="true" fill="currentColor"/><span>Google Reviews</span></a>;
}
