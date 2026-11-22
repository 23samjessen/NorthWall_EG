# Editing public company details

Edit **`lib/company-profile.json`** for the public company information, contact details and team. It contains public presentation content only. Do not put passwords, API keys, internal personnel details or private employee data in this file.

The company is preparing for launch. Registration, tax and address fields are intentionally empty. The current Site stays private and its pages remain `noindex`; editing this file does not publish it or change access permissions.

## What to edit

| Content | JSON location | Where it appears |
| --- | --- | --- |
| Display name | `company.displayName` | Shared configuration and footer copyright. The visual logo/wordmark remains in `components/brand.tsx`. |
| Legal company name | `company.legalName` | Company information area in the footer, when populated. |
| Tax registration | `company.taxRegistrationNumber` | Footer company information, when populated. |
| Commercial registration | `company.commercialRegistrationNumber` | Footer company information, when populated. |
| VAT registration | `company.vatNumber` | Footer company information, when populated. |
| Registered address | `company.registeredAddress` | Footer company information, when populated. |
| Telephone numbers | `contact.phones` | Footer; the first enabled primary number also appears beside the FAQs. |
| Email addresses | `contact.emails` | Footer contact column. |
| Company social profiles | `contact.socialLinks` | Footer contact column. |
| Contact/office hours | `contact.officeHours` | Footer contact column. |
| Service areas and offices | `contact.locations` | Footer locations; addresses and map links appear only when supplied. |
| People, titles, photos and biographies | `team` | **Our team** section at `#team`, linked from navigation and footer. |
| Extra company content | `additionalContent` | Additional cards after the team section. |
| Extra public links | `additionalLinks` | A supplementary footer link row. |
| Main hero image | `website.heroImage` | Main hero for the standard theme. The Nile-theme image is selected in `components/marketing.tsx`. |
| Canonical site origin | `website.origin` | Metadata, service canonical links and sitemap. Changing this does not connect a domain. |

The legal fields are plain strings. Add only the details you intend to display publicly. Blank values are omitted, and the entire company-information block stays hidden while all of them are blank.

## Add or change a telephone number

The current primary number is **+45 53 88 23 02**. A second, disabled slot is already present.

1. Find the record with `id: "additional-phone"`.
2. Enter the actual `number` and its English/Arabic `label`.
3. Change `enabled` to `true`.
4. Set `primary` to `true` only if it should become the primary contact. Keep one primary number.

You can add more records by copying the same shape and assigning each a unique `id`. The dial link is generated automatically from the number. Empty, disabled or invalid numbers do not create controls.

The same pattern applies to email addresses, social links and office hours: fill the value, set a meaningful label and enable the record. An email entry uses `address`; a link entry uses `url`; an hours entry uses `value.en` and `value.ar`.

## Team profiles and photographs

The two configured public profiles are:

| Profile ID | Name | English title | Current image |
| --- | --- | --- | --- |
| `pernille-jessen` | Pernille Jessen | CEO & IoT Engineer | `public/assets/team/pernille-jessen.svg` |
| `sam-jessen` | Sam Jessen | Network & Cybersecurity Engineer | `public/assets/team/sam-jessen.svg` |

These SVGs are labelled monogram placeholders, not portraits. Each card currently says **Photograph forthcoming**. No personal photographs or invented biographies have been added.

To replace a placeholder:

1. Put the authorised photograph in `public/assets/team/`, for example `pernille-jessen.webp`.
2. Set that person's `image` to `/assets/team/pernille-jessen.webp`. Public image paths omit the `public` directory.
3. Write descriptive `imageAlt.en` and `imageAlt.ar` text.
4. Set `imageIsPlaceholder` to `false`.
5. Add a supplied biography in `bio.en` and `bio.ar`, if desired. Empty biographies remain hidden.

Titles are arrays. Pernille's English array is `["CEO", "IoT Engineer"]`; the interface joins the titles as **CEO & IoT Engineer**. Sam has one title, **Network & Cybersecurity Engineer**. Arabic title text is editable separately.

To add someone else, copy the disabled `additional-team-member` record, give it a unique `id`, and fill in `name`, at least one title and a valid image. Add a real photo or an explicitly labelled monogram placeholder, then enable the record. A profile without a name, title or valid image is not rendered.

Optional profile `links` use this shape:

```json
{
  "id": "professional-profile",
  "enabled": true,
  "label": { "en": "Professional profile", "ar": "الملف المهني" },
  "url": "https://example.com/replace-with-approved-profile"
}
```

The URL above is a documentation example; replace it before enabling a link.

**Public team content does not grant login access.** Adding or changing a person here does not create an employee account, change a workspace role or publish their internal profile. Employee membership is managed separately in the workspace backend and administrator interface.

## Locations and hours

The initial location records describe **service areas in Egypt and Denmark**. They do not claim registered offices or street addresses.

A location has a localised `name`, a `kind` (`service-area` or `office`), an optional `address` and optional `mapUrl`. Use `office` only for an actual office you intend to identify publicly. The registered legal address is a separate company field.

Office-hour values are editable text. Include the timezone and actual agreed availability. No opening hours or 24/7 response commitment is invented when the fields are blank.

## Future content and links

The disabled templates are ready for later additions:

- **`additionalContent`**: requires `enabled: true`, a nonempty `title` and `body`. Optional `image`, `imageAlt` and `link` fields add an image or working destination. Text is displayed as text, not executable HTML.
- **`additionalLinks`**: requires `enabled: true`, a nonempty `label` and a valid `url`.
- **`contact.socialLinks`**: follows the same enabled/label/URL pattern.

Blank and disabled records are hidden. Unsupported or unsafe URLs are omitted rather than displayed as dead buttons. Disabling every team record also removes the team navigation link and section.

Supported internal section anchors include `#expertise`, `#industries`, `#approach`, `#about`, `#team` and `#contact`. Link only to sections that remain enabled. Service pages use paths such as `/en/services/microsoft-365`.

## Languages, images and safe links

Localised text uses `{ "en": "...", "ar": "..." }`. Arabic pages preserve right-to-left layout. If a translation is blank, the available English text is used; if English is blank too, the available Arabic text is used.

Images use a local `/assets/...` path, matching the deployed image security policy. Save approved photographs under `public/assets/` and reference their local path. Supported extensions include SVG, WebP, AVIF, PNG, JPEG and GIF. External image URLs, script/data URLs, protocol-relative URLs and local parent-directory traversal are rejected.

Public links permit HTTPS, same-site paths and normal section anchors. `javascript:`, `data:`, protocol-relative URLs and URLs containing credentials are rejected. Telephone and email links are constructed from validated telephone/email fields.

## Related source files

- `lib/site-config.ts` imports the JSON, filters enabled/populated records, validates links and retains the existing `siteConfig` API.
- `components/marketing.tsx` renders the team, contacts, populated legal details and optional content.
- `app/globals.css` contains the team styles under `.nw-marketing .nw-team` and company-detail styles under `.nw-public-*` / `.nw-company-legal`.
- `public/assets/team/` contains the current monogram placeholders and is the recommended location for future team photographs.
- `app/layout.tsx` and `app/robots.txt/route.ts` control the current no-index policy. Do not change launch visibility merely to edit content.

After editing, check that the JSON is valid (no comments or trailing commas), run `npx tsc --noEmit`, and review both `/` and `/ar` at desktop and mobile widths. An updated build/deployment is needed for source changes to appear on the hosted demo; this file does not update a live database.
