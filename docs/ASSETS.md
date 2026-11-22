# NorthWallEg — brand and image assets

The NW monogram is editable vector source in `components/brand.tsx`; the standalone version and favicon are in `public/assets/nw-monogram.svg` and `public/favicon.svg`.

The new hero asset is `public/assets/egypt-hero.webp`. It was generated for this design using the built-in image generation tool and exported to WebP. The original generated image remains in the creating conversation. This is an architectural visual concept, not a photograph of company premises or a claim of an office at Giza.

Final hero brief:

> Premium editorial architecture photograph, wide landscape. An ancient Giza pyramid on the right in warm late-afternoon light, framed by contemporary Egyptian limestone architecture and a palm. The left area is calm shadowed limestone suitable for white HTML copy. Refined Scandinavian architecture-magazine composition, natural stone textures, uncluttered, no people, text, logos, watermarks or cyber-themed graphics.

The existing supporting WebP assets (Egyptian office, collaboration, network, cyber defence, websites, employee application, school/healthcare and team workspace) were recovered from Sam's previous NorthWall approval package and reused as illustrative concepts. They are not presented as customer projects or company locations.

Image files are served locally; the page does not depend on a third-party image host. Replace a file in `public/assets/` or update its reference in `lib/site-config.ts` / `components/marketing.tsx`. Keep meaningful alternative text and compress replacement images. RTL layout mirrors the hero presentation with CSS so the quiet image area remains behind the Arabic heading.

Colours are CSS tokens. Use `--clay`, `--ink`, `--paper`, `--soft` and `--line` in `app/globals.css` for the public site, and `--nw-accent`, `--nw-ink`, `--nw-paper`, `--nw-bg` and `--nw-line` in `app/workspace/workspace.css` for the employee area.
