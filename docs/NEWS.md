# Live English cybersecurity and IT news

NorthWallEg reads eight official publisher feeds. Headlines link to the original publisher and keep the publisher's publication date. The site does not manufacture headlines, publication dates, severity ratings or attack locations. This is a selected news and advisory feed, not comprehensive incident monitoring or a replacement for your organisation's vendor alerts and vulnerability-management process.

## Official sources

These exact endpoints were verified and successfully refreshed on 23 November 2026. The configuration and exact permitted hosts are in `lib/news-source.ts`.

| Source shown in the interface | Feed | Coverage |
| --- | --- | --- |
| Microsoft Security | https://www.microsoft.com/en-us/security/blog/feed/ | Microsoft security research and product news |
| Microsoft Blog | https://blogs.microsoft.com/feed/ | General Microsoft and IT news |
| Cloudflare Blog | https://blog.cloudflare.com/rss/ | Internet infrastructure, cloud and security |
| Cisco Talos | https://blog.talosintelligence.com/rss/ | Cisco's threat research and security intelligence |
| Splunk Security Advisories | https://advisory.splunk.com/feed.xml | Official product security advisories, including explicit Splunk SOAR advisories |
| Palo Alto Networks | https://www.paloaltonetworks.com/blog/tag/soar-2/feed/ | Dedicated official SOAR topic feed |
| Unit 42 | https://unit42.paloaltonetworks.com/feed/ | Threat research, malware, cybercrime and attacks |
| CERT-EU | https://cert.europa.eu/publications/security-advisories-rss | Vulnerability, exploitation and security advisories |

SOAR means security orchestration, automation and response. It is a topic, not a publisher. The dedicated Palo Alto Networks feed is labelled with its real publisher. Splunk coverage comes from its official security advisory feed; it is not described as a general Splunk blog feed.

Most configured feeds declare an English language. Cisco Talos omits a feed language declaration; its official homepage declares English and its feed content was verified as English. The loader rejects any explicitly non-English feed or entry. It does not perform machine translation or claim probabilistic language detection of undeclared text.

## How headlines are selected and labelled

The parser considers up to 40 entries per source. Selection keeps a maximum of 12 eligible articles per source, chooses one article from each source in turn and stops at 48 total. Each publisher's queue is newest first. The combined list is **source balanced**, so a prolific publisher does not hide Cisco, Splunk or the older SOAR topic articles. It is not one globally chronological list. The interface can filter all returned articles by publisher, topic and search text.

Duplicate article URLs appear once; explicit topic metadata is combined. Publication dates remain the dates supplied by publishers. Missing or invalid dates are `null`, and the interface should say that a date was not supplied. CET and CEST are normalised to their proper UTC offsets. Feed retrieval time is never substituted for an article's publication time. In the verified snapshot, the dedicated SOAR source's newest returned article was published on 30 July 2026; an older article is not relabelled as a new incident.

The optional `topics` array is derived from each article's title, up to 2,000 characters of its summary, and its category tags. It can include SOAR, Security automation, Malware, Ransomware, Active exploitation, Vulnerabilities, Threat intelligence, Cloud security, Cyberattacks and Security updates. These are navigation aids, not an analyst assessment of impact or severity.

SOAR requires an explicit uppercase acronym, XSOAR product mention, SOAR category tag or the expanded term. A generic automation article or the English verb “soar” is insufficient. The dedicated SOAR feed also requires a matching article, even if the source itself is a SOAR topic feed. Active exploitation requires explicit affirmative wording and excludes common negations and speculative language. Conservative keyword matching can miss relevant articles; absence of a label does not establish the absence of a threat.

A healthy SOAR feed with no matching entries is reported as `empty` and the topic coverage as `no_matches`. It is not a source outage. Empty topic filters show an honest empty state rather than unrelated filler.

## Refresh, cache and fallback behaviour

`lib/news-service.ts` exports `getNews(): Promise<NewsResult>`. Both the API route and the server-rendered insights page call this shared loader; server pages do not make an HTTP request back to their own API.

- The public ticker and workspace poll `/api/news` every two minutes while their components are mounted. Reopening a news view can also trigger a request.
- Successful live or partial responses are retained in a Worker-instance memory cache for ten minutes. Concurrent refreshes in the same instance share one in-flight request.
- The API adds a public browser/intermediary cache of two minutes for live or partial data. Cached-fallback and unavailable responses use one minute.
- Refresh is **on demand**. A request after the cache expires fetches the configured feeds. There is no scheduled polling job, cron trigger or continuously running feed connection on the server.
- Separate Worker instances may have separate memory caches. Restarting an instance clears its memory cache but preserves the bundled snapshot.
- If every usable live feed fails or yields no eligible articles, the loader uses its last successful in-memory article set, or the bundled real snapshot in `lib/news-snapshot.json`. A partial live result is served as partial; missing publishers are not silently filled from stale data.
- After a total failure, another upstream attempt becomes eligible after one minute, when the next request arrives. The site does not overwrite its good snapshot with an error response.

The normal displayed refresh delay includes the ten-minute server cache, the two-minute browser cache and the client's polling interval. “Live” means retrieved from official publisher feeds with this cache policy; it does not promise second-by-second updates.

### Response fields

`GET /api/news` returns JSON and `X-Content-Type-Options: nosniff`.

| Field | Meaning |
| --- | --- |
| `items` | Up to 48 source-labelled headlines. Each has `id`, `title`, `url`, `source`, `category`, `publishedAt`, and optional `topics`. |
| `status: live` | The current fetched set has articles and all configured feeds completed without errors. A healthy empty topic feed is allowed. |
| `status: partial` | Some current articles were retrieved, but at least one configured source failed. |
| `status: cached` | No usable current articles were retrieved, so previously fetched real articles are shown. |
| `status: unavailable` | Neither usable current articles nor a usable previous snapshot are available. |
| `fetchedAt` | UTC time when the displayed set was successfully fetched; `null` when no set exists. A fallback retains its original time. |
| `checkedAt` | UTC time of the upstream attempt represented by this result. Cache hits retain that attempt time; they are not falsely labelled as new checks. |
| `snapshotFetchedAt` | Present for fallback results; the original successful fetch time of the displayed saved set. |
| `cacheSeconds` | Server cache lifetime for this result: 600 for live/partial, 60 for outage responses. |
| `errors` | Source names and safe unavailable messages. Development responses may include bounded diagnostic codes; production omits these codes. |
| `sources` | Each configured source's ID, name, feed URL, category, optional topic, current availability, eligible count and displayed count. |
| `topicCoverage` | Counts and `available` or `no_matches` for the displayed article set. |
| `selectionPolicy` | `source-balanced`. |
| `language` | `en`. |

During a cached fallback, `sources[].status` and `availableCount` describe the failed or empty current refresh attempt, while `selectedCount` counts the saved articles being displayed. `topicCoverage` always describes the displayed articles. The interface must keep the cached status visible and must not present saved articles as a successful current refresh.

## Security and operational boundaries

Feeds are configured in code. The API does not accept a user-provided feed URL. Outbound requests use HTTPS, a publisher-specific exact-host allowlist, manual redirect validation before following each redirect, at most three redirects, a seven-second request deadline and a two-million-byte response limit. Article links are also checked against their publisher's host allowlist. Credential-bearing and non-HTTPS URLs are discarded.

The parser reads supported RSS or Atom fields without evaluating HTML or executing XML entities. It rejects DOCTYPE and ENTITY declarations, strips markup from displayed text and does not copy full publisher articles into the UI. The client must continue rendering titles as plain text. Only headlines, source metadata, topics and links are returned; the summaries used for classification are not returned.

A publisher outage, deadline, unsupported redirect, oversized response or blocked preview-network request is shown as a source failure. Some managed local preview environments restrict external requests even when deployed hosting can fetch successfully. Check the deployed API's status and source list before treating a preview-only failure as a publisher outage. Do not broaden the network allowlist or fabricate success to conceal failures.

## Maintenance commands and files

From the repository root, after installing the lockfile dependencies:

```sh
npm run test:news
npm run news:refresh
npx tsc --noEmit
```

`test:news` runs deterministic fixture-based checks against the actual parser, selection and cache modules; it does not contact external sites or change the saved headlines. It covers English metadata, safe links and redirects, XML declarations, date handling, explicit SOAR labels, exploitation negation, source fairness, duplicate handling, healthy empty feeds, partial outages, size bounds, coalesced requests, cache expiry and fallback timestamps.

`news:refresh` makes real requests to the configured feeds. It writes the snapshot atomically only when all configured feeds complete successfully and there are usable articles. Valid empty topic feeds are permitted. If any source fails, it exits unsuccessfully and preserves the previous snapshot. Inspect the printed per-source counts and errors; retry after a transient publisher failure. Do not replace the snapshot with invented headlines or a new timestamp applied to old data.

| File | Change here |
| --- | --- |
| `lib/news-source.ts` | Verified publisher URLs/hosts, parsing, topic rules, request limits, source-balanced selection and response types |
| `lib/news-service.ts` | Shared server cache, in-flight coalescing and honest fallback state |
| `app/api/news/route.ts` | HTTP response headers and API entry point |
| `lib/news-snapshot.json` | Generated fallback data; refresh through the script |
| `scripts/refresh-news.mjs` | Real source snapshot refresh using the production parser |
| `scripts/test-news.mjs` | Deterministic news regression checks |
| `components/news-explorer.tsx` | Shared source/topic/search controls and result display |
| `components/marketing.tsx` and `components/workspace.tsx` | Public and signed-in news entry points and client polling |
| `app/insights/` | Server-rendered security news hub and original guides |

When adding a publisher, verify its official feed link and article host, English provenance, content size and response time. Add only the exact necessary hosts and keep source errors visible. Review topic selection against real article metadata. Update the tests, this document and the real snapshot, then verify the deployed API after publication.
