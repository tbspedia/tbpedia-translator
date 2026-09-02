# True Buddha Translator

> **"The complete collection of wondrous wisdom, enlightening the mind and realizing the nature, begins from this point."**
> A translation plugin for Obsidian that suppport True Buddha Pedia contents.


---


## Three Key Strengths

### 1. Hover Translation That Keeps You in the Flow
No need to switch to a browser. Simply hover over a word or sentence and a popup instantly shows its meaning. Leverages Google's dictionary feature (POS) to display parts of speech, detailed definitions, and transliteration.

### 2. A Hybrid Engine for Every Use Case
**Speed** — Blazing-fast Google / Google GTX  
**Precision** — Reliable DeepL / Bing / Yandex / Papago  
**Context** — Context-aware LLM (OpenAI-compatible / Ollama / LM Studio)

Assign the best engine independently for hover, text selection, and full-page translation.

---

## What's New in v1.0.0

---

## Features

- Hover translation for words and sentences
- Translation of selected text
- **Full-page translation in Reading View**
- **Glossary sidebar** — browse active glossary terms and their translations
- Choose trigger: mouseover / text selection / both
- Choose hover unit: word / sentence
- **Per-context engine selection** — assign different engines for hover, selection, and page translation
- 10 translation engines supported
- Auto-detection of source language
- Configurable hover delay
- Display of dictionary entries (with parts of speech)
- Display of transliteration / romanization
- Display of source text
- Display of detected language information
- In-memory translation cache (fast re-lookup)
- **Restrict to note content** — option to limit translation to editor/preview only
- **Skip same-language** — hide tooltip when source and target language match
- **Skip identical translations** — hide tooltip when translation result matches input
- Automatic application of Obsidian theme colors
- Command palette support:
  - Hide tooltip
  - Toggle translation on/off
  - Translate selected text
  - **Translate current page**
  - **Restore original (page translation)**
  - **Open glossary**

---

## Usage

1. Enable the plugin in Obsidian
2. Open plugin settings
3. Select a translation engine and target language
4. Hover over a word or select text to show a translation tooltip

Press `Esc` to close the tooltip.

### Page Translation

Switch to **Reading View**,  run the **"Translate current page"** command. A progress bar is displayed while each block is being translated. Click the Translate page/Restore icon again (or run the **"Restore original"** command) to revert. You can also cancel the translation with the ✕ button on the progress bar.

After translation, hover over any paragraph to see the original text in a tooltip.
Save translated page as new note.
Saved translated and dual-language notes include a `translationengine` YAML property. When an OpenAI-compatible API, Ollama, or LM Studio performs the translation, they also include `translationmodel` with the configured LLM model name.


### Glossary

An `exact` glossary match returns the preferred target translation without calling a translation service. Use `contains` to enforce a literal term inside a longer sentence, or `regex` for a trusted pattern. The plugin protects matched text before translation and restores the approved target term before the result is shown. Use `|` to separate aliases. Existing `phrase` entries remain compatible and are treated as `contains`.

Click the book icon in the ribbon or run **"Open glossary"** to browse active terms, aliases, matching modes, and translations. Use the refresh button after changing `glossary.json`.

Don't manually edit and add the glossary.json file because the glossary will be updated from the Github site. You can email to editor@tbpedia.org for feedback and recommendation of new glossary
---

## Settings

| Setting | Description |
| --- | --- |
| Enabled | Master switch for translation |
| Restrict to note content | Respond only within note body (editor / preview / embeds). When disabled, translates across the entire Obsidian UI |
| Hover engine | Engine used for mouseover translation |
| Selection engine | Engine used for text-selection translation |
| Page engine | Engine used for full-page translation |
| Translate from | Source language (includes auto-detect) |
| Translate to | Target language |
| Trigger | Mouseover / selection / both |
| Mouseover unit | Translate the word or sentence under the cursor |
| Hover delay | Wait time before translation starts |
| Show dictionary | Display dictionary-style results when available |
| Show transliteration | Display transliteration / romanization |
| Show source text | Display original text in the tooltip |
| Show detected language | Display detected source and target language |
| Skip same-language translations | Hide tooltip when detected language matches target language |
| Skip identical translations (strict) | Also hide tooltip when translation result is identical to input |
| Disable translation cache | Call the API every time, bypassing the in-memory cache |

---

## Translation Engines

The default engine is Google.

Experimental engines may stop working due to upstream service changes.

| Engine | Notes |
| --- | --- |
| Google | Default. Supports dictionary entries and transliteration |
| Google GTX | Alternative Google endpoint |
| DeepL | Experimental web endpoint |
| Bing | Experimental web endpoint |
| Yandex | Experimental web endpoint |
| Papago | Experimental web endpoint |
| OpenAI-compatible API | Any server implementing the OpenAI Chat Completions API. Requires API URL and model name. API key and custom prompt template are also configurable |
| Ollama | Local inference via Ollama. Requires a running Ollama server and model name |
| LM Studio | Local inference via LM Studio. Requires a running LM Studio server and model name |

### LLM Engine Settings

When an LLM engine (OpenAI-compatible / Ollama / LM Studio) is selected for any context, the following additional settings appear.

| Setting | Description |
| --- | --- |
| API URL | Base URL of the server (e.g. `https://api.openai.com`, `http://localhost:11434`) |
| API Key | API key (OpenAI-compatible only; leave blank for local servers) |
| Model | Model name to use for translation |
| Temperature | Generation randomness. `0` = deterministic, `2` = maximum randomness. Default: `0` |
| Prompt template | Custom prompt template. Use `{{text}}` for source text and `{{targetLang}}` for the target language name. Leave blank to use the built-in default |

---

## Installation

### Community Plugins (Recommended)

You can also use Obsidian42 - BRAT (https://github.com/TfTHacker/obsidian42-brat)- BRAT  to install this plugin. Input tbspedia/tbpedia-translator in the configuration of BRAT.

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css`
2. Place them in:

   ```
   <your vault>/.obsidian/plugins/tbpedia-translator/
   ```

3. Restart Obsidian or reload the plugin
4. Enable `Tbpedia Translator` from Community plugins

---

## Requirements

- Obsidian desktop app
- Minimum version: `1.12.0`

This plugin is desktop-only.

---

## Notes

- Translation requests are sent to the selected translation service.
- Obsidian's `requestUrl` API is used for network requests.
- Experimental engines may become unstable due to upstream service changes.
- The plugin is fork from https://github.com/amanetoki7/mouse-tooltip-translator , customise to support the translation of True Buddha Pedia contents.
---

## License

MIT License

---

*Inspired by the [Mouse Tooltip Translator](https://chromewebstore.google.com/detail/mouse-tooltip-translator/hmigninkgibhdckiaphhmbgcghochdjc?hl=ja) Chrome extension.*
