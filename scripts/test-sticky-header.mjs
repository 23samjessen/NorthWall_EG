import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// The marketing wrapper must not become a scroll container, otherwise
// a sticky header would stick to that wrapper instead of the viewport.
const marketing = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
const insights = await readFile(new URL('../components/insights.css', import.meta.url), 'utf8');
const wrapper = marketing.match(/\.nw-marketing\{[^}]+\}/)?.[0];
const header = marketing.match(/\.nw-header\{[^}]+\}/)?.[0];
const insightsHeader = insights.match(/\.nw-insights-header\s*\{[^}]+\}/)?.[0];

assert.ok(wrapper && header && insightsHeader, 'The expected public-header selectors must exist');
assert.match(wrapper, /overflow-x:clip/);
assert.doesNotMatch(wrapper, /overflow:(?:auto|scroll|hidden)/);
assert.match(header, /position:sticky;top:0/);
assert.match(header, /z-index:[1-9]\d*/);
assert.match(insightsHeader, /position:sticky;top:0/);
assert.match(insightsHeader, /z-index:[1-9]\d*/);
console.log('Public sticky header CSS regression checks passed.');
