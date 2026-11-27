# True Buddha Pedia Translator — Design Architecture Specification

## 1. Purpose and scope

True Buddha Pedia Translator is an Obsidian community plugin for translating
note content in three interaction modes:

- hover translation of a word or sentence;
- translation of selected text and the Translation sidebar;
- full-page translation in Reading View, including saving translated and
  bilingual notes.

The plugin is intentionally a lightweight JavaScript plugin: the production
implementation is primarily in `main.js`, with `manifest.json`, `styles.css`,
the packaged `glossary.json`, and documentation as supporting artifacts.

This document is the architecture reference for future changes. It describes
implemented behavior, contracts, boundaries, and non-goals; it is not a claim
that third-party or reverse-engineered endpoints are stable.

## 2. Architecture overview

```text
Obsidian events / commands / views
              |
              v
MouseTooltipTranslator (plugin coordinator)
  |           |              |
  |           |              +--> PageTranslator
  |           +-----------------> TooltipManager / TranslationView
  +-----------------------------> Settings, GlossaryStore, command handlers
                                      |
                                      v
                         translateWithGlossary(...)
                                      |
                                      v
                       Engine registry and capability checks
                  /             |                 \
          web engines       LLM Provider       local engines
                             /       \           /       \
                    ChatGPT OAuth  Antigravity  Ollama  LM Studio
```

The central coordinator owns loaded settings, the active glossary, page
translator, tooltip, provider instances, ribbon actions, command registration,
and the settings tab. Feature-specific components must use its shared
translation pipeline rather than calling a provider directly, except for the
validated Antigravity page-batch fast path.

## 3. Configuration model

`DEFAULT_SETTINGS` is the schema and compatibility baseline. Settings are
merged on load, so newly added values receive defaults without invalidating an
existing vault configuration.

### Feature routing

Each feature selects its own engine:

| Setting | Responsibility |
| --- | --- |
| `mouseoverEngine` | Hover tooltip translation |
| `selectionEngine` | Selected text and Translation sidebar default |
| `pageEngine` | Reading View page translation |
| `languagePickerEngine` | Engine that determines language-selector capabilities |

Source and target languages are canonical plugin codes. Provider-specific code
mapping is encapsulated by each engine. Saved but unsupported language choices
are preserved and clearly marked instead of silently replaced.

### LLM configuration

`localLlm` is the compatibility engine key for generic provider-based LLM
translation. Its profile stores provider, endpoint, API key, model, and a
shared system prompt. Provider profiles preserve endpoint/key/model state when
switching profiles.

Ollama and LM Studio are **dedicated engines**, not LLM Provider presets. This
avoids duplicate configuration paths. Older saved generic profiles are exposed
only as legacy entries so existing configuration is never silently deleted.

## 4. Translation pipeline

All normal translations follow this sequence:

1. Validate plugin state and the requested language pair.
2. Prepare text with the glossary.
3. Resolve the effective engine, including platform substitutions.
4. Use cache when allowed.
5. Call the engine and normalize its response into a translation result.
6. Restore protected glossary terms.
7. Cache a successful response and update the feature UI.

The common result model contains `targetText`, source/target language metadata,
optional dictionary entries, and optional transliteration. Engines returning no
translation fail safely rather than rendering an empty successful state.

### Cache identity

The in-memory cache includes source text, source/target language, glossary
revision, engine identity, model, and prompt fingerprint. For ChatGPT OAuth it
also includes the selected reasoning level. Changing a model or prompt must not
reuse output created under a different model contract.

### Retry and fallback

Page and long-selection translation retry a missing result with bounded
backoff. Supported public web engines can use a compatible fallback engine
(`FALLBACK_SWAP_LIST`: `googleGTX`, `bing`, `baidu`) when a rate limit or
endpoint failure occurs. `deepl` is intentionally excluded from automatic
fallback because DeepL's legacy unauthenticated web JSON-RPC endpoint returns a
deprecation notice with HTTP 200. Provider errors are surfaced rather than
automatically falling back to a different paid/account-backed model.

## 5. Engine registry and platform policy

The engine registry contains Google, Google GTX, DeepL, Bing, Yandex, Papago,
Baidu, experimental Google variants, LLM Provider, Ollama, and LM Studio.

- Web engines use Obsidian HTTP facilities and normalize their own response
  shape.
- Local engines are unavailable on mobile when their transport cannot run
  there; the effective-engine resolver selects a safe fallback where designed.
- ChatGPT OAuth and Antigravity are desktop-only provider transports.
- The Chrome-only `browserAPI` (`Browser Translator API`) engine was removed
  because Obsidian's Electron and mobile WebView runtimes do not ship Chrome's
  TranslateKit component updater; legacy `browserAPI` settings migrate
  automatically on load to `google` (or the default panel engine).
- Engine capabilities determine which canonical language pairs are allowed.

Experimental web endpoints are intentionally treated as volatile integrations.
Their availability is not a plugin API guarantee.

## 6. Glossary architecture

`GlossaryStore` loads the packaged `glossary.json` immediately, then may check
the published GitHub glossary in the background. A remote glossary replaces the
local copy only when its version/revision is newer.

Supported matching modes are:

- `exact`: return the approved target without an engine request;
- `contains`: protect literal terms in a larger request;
- `regex`: protect trusted pattern matches.

Protected terms are replaced by MT-safe ASCII markers (`[MTTG<n>]`) before
translation and restored afterward with a tolerant matcher (allowing optional or
localized brackets and whitespace, guarded by `(?!\d)`) so engines such as
Yandex or LLMs that rewrite delimiters do not leak raw tokens. Glossary revision
participates in cache identity. A glossary update clears active tooltip cache
and refreshes consumers.

## 7. Tooltip and selected-text interaction design

`TooltipManager` owns the tooltip DOM element, cache, current translation token,
and rendered result. It hides output for explicitly identical source/target
languages and can suppress identical translated text based on settings.

Hover movement generates frequent DOM events. Slow LLM calls used to be
cancelled by subsequent events before their response arrived. The tooltip now
tracks an in-flight request identity; repeated events for the same text,
language pair, provider, model, and prompt reposition the tooltip without
starting a replacement request.

Selection has priority over hover. While a non-empty selection is active,
mousemove following is paused until selection is cleared. During page
translation, an optional mode shows the stored original paragraph instead of
translating already translated page text.

## 8. Page translation architecture

`PageTranslator` translates rendered Reading View leaf blocks and retains a
manifest of original-to-translated content. It observes Reading View rerenders
so newly materialized blocks join the current job.

### Standard page queue

1. Read and parse source note data when available for save/export support.
2. Optionally translate human-readable YAML values.
3. Queue deduplicated source and rendered blocks.
4. Translate blocks, apply completed manifest entries to Reading View, and
   update the progress UI.
5. Build a translated-note snapshot when all required content succeeds.

Long content is split at sentence boundaries. LLM paths use a conservative
700-character chunk size to reduce truncation risk. Web-engine page requests
remain sequential and keep a short inter-block delay because public endpoints
commonly throttle concurrent calls.

### Antigravity performance path

Antigravity page translation has a separate, controlled throughput design:

- Default concurrency is two workers; users may choose one to three sessions.
- Each worker uses a reusable sandboxed CLI session.
- Short blocks are micro-batched: up to four blocks and 2,800 source characters
  per CLI turn.
- Batch output must map every input id exactly once. Completed batches are
  immediately applied to Reading View.
- Long blocks stay on the ordered 700-character path.
- Cache hits and exact glossary hits bypass the CLI.
- If a batch response is malformed, every affected block falls back to the
  established individual translation path.

This improves throughput and progressive rendering but does not make an
agent/model runtime as low-latency as a dedicated Bing or Baidu web translation
endpoint.

Cancellation and `restorePage()` cancel any in-flight translation, hide
progress, clear translation state, and synchronously restore every translated
block in a single pass. Because Obsidian's Reading View virtualizes long notes
by detaching off-screen `section.el` nodes while keeping them cached in
`view.previewMode.renderer.sections`, restoration and `hasTranslation()` collect
markers across the mounted container, all cached `renderer.sections` elements,
and a tracked `_translatedElements` set so off-screen sections do not reappear
translated when scrolled back into view. A CLI turn already running may settle
before its idle cleanup.

## 9. ChatGPT OAuth provider

### Authentication and persistence

ChatGPT OAuth uses a desktop PKCE loopback flow with the Codex-compatible public
client id. Authorization, token exchange, refresh, and best-effort revocation
use the OpenAI authentication service.

Tokens are encrypted with Electron `safeStorage` when an OS keychain is
available. When secure storage is unavailable, desktop authentication remains
usable only for the active Obsidian session; tokens are deliberately not
persisted across restart.

JWT claims are used to recover account id, email, and plan information. When
available, the account id is included in the supported account-id request
headers.

### Responses transport

Translation uses the ChatGPT Codex Responses endpoint through Node HTTPS to
avoid browser CORS restrictions. The SSE collector accepts text deltas,
completed output items, terminal completions, and terminal failures. A 401
causes one refresh/retry; errors expose bounded backend detail without exposing
token values.

GPT-5-family requests include a configurable reasoning object. The UI exposes
Minimal, Low, Medium, and High, with Low as the safe default for the Codex
transport. The exact accepted model set, quota, and reasoning support remain
account- and backend-dependent.

### Model selection

The provider fetches the account-specific Codex model list. When discovery is
unavailable, a known fallback lineup prevents an empty picker but does not prove
account entitlement. The UI uses a native select, not a datalist, so every
fetched model remains available after one model is chosen. Public model ids are
persisted with the provider profile; OAuth secrets are not.

## 10. Antigravity CLI provider

Antigravity is desktop-only and assumes that the user has already installed and
authenticated `agy`. The plugin never reads or stores Google credentials.

Each CLI session:

- runs in an isolated temporary workspace;
- uses the fixed sandboxed stream-JSON command form;
- validates model identifiers before process launch;
- forbids tools, MCP, browser, command, and file activity in its translation
  protocol;
- rejects malformed stream events and attempted tool actions;
- keeps a completed session alive for 30 seconds, then terminates it and
  removes its workspace.

Single-item responses must be JSON in this form:

```json
{"kind":"final","text":"translated text"}
```

Page batches must be JSON in this form:

```json
{"kind":"batch","items":[{"id":"block-0","text":"translated text"}]}
```

The provider selects the least-busy reusable session from the configured pool,
bounded at three sessions per model.

## 11. UI, views, and commands

The plugin supplies:

- a configurable Settings tab, localized through the `STRINGS` catalog;
- a hover tooltip;
- Translation, Glossary, and legacy Vocabulary views;
- ribbon actions for page translation and glossary access;
- commands for translation panel, current selection, page translation, restore,
  copy, hide tooltip, glossary, and plugin control.

Settings are shown contextually: provider settings appear only when an LLM
engine is used by a feature. ChatGPT OAuth shows connection state, model menu,
and reasoning level. Antigravity shows model discovery and page-worker count.

## 12. Security and privacy boundaries

- Translation text is transmitted only to the selected engine/provider.
- API keys remain in plugin settings; OAuth tokens receive OS-backed encryption
  when available and session-only behavior otherwise.
- The plugin does not persist Antigravity/Google credentials.
- Antigravity launches only a fixed, sandboxed command form and rejects unsafe
  protocol behavior.
- Glossary remote replacement is versioned but intentionally overwrites local
  glossary edits when the published source is newer.
- No translation cache is persisted; it is memory-only.

## 13. Extension rules

When adding an engine or provider:

1. Add its engine adapter and normalized response contract.
2. Declare language capability and platform availability.
3. Include any behavior-affecting settings in cache identity.
4. Route feature calls through glossary preparation and language validation.
5. Preserve old settings through migration or explicit legacy behavior.
6. Add bounded errors, retry/rate-limit behavior, and safe UI diagnostics.
7. Do not place secrets in model metadata, cache keys, logs, or documentation.

When adding a page performance optimization, preserve ordered restoration for
long chunks, stable block identity, cancellation safety, progressive rendering,
and individual fallback for malformed batched output.

## 14. Verification baseline

Minimum source validation after implementation changes:

```text
node --check main.js
git diff --check
```

Provider integration testing additionally requires a user-owned account and is
performed manually in Obsidian. Tests must not log OAuth tokens, API keys, or
account identifiers.
