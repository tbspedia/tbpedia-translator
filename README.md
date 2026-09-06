# True Buddha Pedia Translator

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

### 3. A translation based on the control vocab from True Buddha School of Network Administarion
The current glossarry is refer to the English translation vocab from Traditional Chinese published at https://truebuddhaschool.org/listofterms .
The glossary.json version 1 , revision 3 only containt a limited vocab where it will be expand in the near future. We will welcome contribution of translation to other languages as well.

---

## What's New in v1.0.1

---

## Features

- Hover translation for words and sentences
- Translation of selected text
- **Full-page translation in Reading View**
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
  - Open translayion panel
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

The engine list fully mirrors the reference Chrome extension (v0.1.246). 

The default engine is google.

Experimental engines may stop working due to upstream service changes.

| Engine | Notes |
| --- | --- |
| google | Default. Supports dictionary entries and transliteration, refer as translate_a/single. |
| bing | Web endpoint |
| LLM - OpenAI / Claude / Gemini / Local | OpenAI-compatible chat completions with provider presets (see below) |
| deepl | Experimental web endpoint |
| yandex | Experimental web endpoint |
| baidu | Experimental web endpoint |
| papago | Experimental web endpoint |
| browser API | Chromium built-in Translator API (requires Chrome 138+ runtime; may be unavailable in Obsidian) |
| googleWebImage | Shows the first Google image search hit for the hovered word |
| googleGTX | Alternative Google endpoint, refer as translate_a/t |
| googleWeb | Google dictionary definition ("meaning:") scrape |
| googleV2 | Google batchexecute endpoint, refer as Google V2 ( experimental) |

### LLM Engine Settings

When an LLM engine (OpenAI-compatible / Ollama / LM Studio) is selected for any context, the following additional settings appear.

| Setting | Description |
| --- | --- |
| LLM Provider | Custom / OpenAI (ChatGPT) / Claude (Anthropic) / Gemini (Google) / Grok (xAI) / Groq / OpenRouter / GitHub Models / Ollama (local) / LM Studio (local). Choosing a preset fills in the endpoint URL; settings per provider are remembered and restored when switching |
| LLM API Endpoint URL | OpenAI-compatible base URL including the version path (e.g. `https://api.openai.com/v1`). Editable only for Custom |
| LLM API Key | API key (leave blank for local servers) |
| LLM Model | Model name. The ↻ button fetches the model list from the endpoint using the API key so you can pick one |

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
- Tbpedia translator disable the Translation history and vocabular list functions.
- The plugin is fork from https://github.com/amanetoki7/mouse-tooltip-translator , customise to support the translation of True Buddha Pedia contents.

---
Change log

V1.0.0 
- The first release of Tbpedia Translator , required use BRAT or manually install the plugin from Github.
  
V1.0.1 
- Redesign the glosssary.json installtion methods where it no longer embedded in main.js file and install the glossary file from github and if the local version is not the newer from github, it will auto download from background. The current glossary.json version is 1 and revision is 3.
  
V1.0.2
- Removed the embedded glossary from main.js
- It downloads and replaces the local file only when:- remote version is higher, or versions match and remote revision is higher.
The old embedded-glossary sync script was removed because it is no longer needed.

V1.0.3 
- Disable the master switch
- change the fallback list as below: 'deepl', 'googleGTX', 'bing', 'baidu'
- Display error message when hot rate-limit from translation engine
  
V1.0.4
- Make a major update on the supported language for each translation engine web endpoint.
- Expanded the canonical picker to 285 entries including Auto Detect.
- Added every language currently returned by Google’s public 249-language catalog; verified no Google catalog code is absent.
- Added Microsoft/Bing’s current public catalog and pass-through support for its BCP-47 tags.
- Updated endpoint mappings so new selections translate correctly, including Google Hebrew/Javanese and Chinese variants, DeepL regional variants, Papago Persian, Baidu Cantonese/Classical Chinese, and newer Yandex codes.
- Corrected Papago’s picker: Persian is now included; obsolete Malay is no longer advertised.
- Capability filters now prevent Microsoft/Yandex-only codes from appearing under Google.
- Static capability check confirms Google: 254 targets (249 live entries plus compatible aliases), Bing: 142 including legacy aliases, Papago: 17, Baidu: 28, DeepL: 39, Yandex: 96.
- Sort the language order by ISO language code
  
V1.0.5
- Change the Plugin Name from True Buddha Translator to True Buddha Pedia Translator (真佛翻譯器）
- Add the Translation engine language support Table
- Fixed the hover translation
- Fixed the restoration of translated page at one-off restore
- Redesign the interafce by removed Translate /restore icon & the drop down meny for page translation engine list
- Create an icon that open the page translation menu - 1.Translate curremt page , 2. Translate page ... for changing the translation engine . 3. Translation setting
  

---
# Translation engine language support

Codes are sorted alphabetically by canonical language code. `✓` means supported and `—` means unsupported. The Google column combines Google Translate, Google GTX, and Google V2 because their capability sets are identical.

| Code | Language | Google | DeepL | Bing | Yandex | Baidu | Papago |
|---|---|---:|---:|---:|---:|---:|---:|
| aa | Afar | ✓ | — | — | — | — | — |
| ab | Abkhaz | ✓ | — | — | — | — | — |
| ace | Acehnese | ✓ | — | — | — | — | — |
| ach | Acholi | ✓ | — | — | — | — | — |
| af | Afrikaans | ✓ | — | ✓ | ✓ | — | — |
| ak | Twi | ✓ | — | — | — | — | — |
| alz | Alur | ✓ | — | — | — | — | — |
| am | Amharic | ✓ | — | ✓ | ✓ | — | — |
| ar | Arabic | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| as | Assamese | ✓ | — | ✓ | — | — | — |
| av | Avar | ✓ | — | — | — | — | — |
| awa | Awadhi | ✓ | — | — | — | — | — |
| ay | Aymara | ✓ | — | — | — | — | — |
| az | Azerbaijani | ✓ | — | ✓ | ✓ | — | — |
| ba | Bashkir | ✓ | — | ✓ | ✓ | — | — |
| bal | Baluchi | ✓ | — | — | — | — | — |
| ban | Balinese | ✓ | — | — | — | — | — |
| bbc | Batak Toba | ✓ | — | — | — | — | — |
| bci | Baoulé | ✓ | — | — | — | — | — |
| be | Belarusian | ✓ | — | ✓ | ✓ | — | — |
| bem | Bemba | ✓ | — | — | — | — | — |
| ber | Tamazight (Tifinagh) | ✓ | — | — | — | — | — |
| ber-Latn | Tamazight | ✓ | — | — | — | — | — |
| bew | Betawi | ✓ | — | — | — | — | — |
| bg | Bulgarian | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| bho | Bhojpuri | ✓ | — | ✓ | — | — | — |
| bik | Bikol | ✓ | — | — | — | — | — |
| bm | Bambara | ✓ | — | — | — | — | — |
| bm-Nkoo | NKo | ✓ | — | — | — | — | — |
| bn | Bengali | ✓ | — | ✓ | ✓ | — | — |
| bo | Tibetan | ✓ | — | ✓ | — | — | — |
| br | Breton | ✓ | — | — | — | — | — |
| brx | Bodo | — | — | ✓ | — | — | — |
| bs | Bosnian | ✓ | — | ✓ | ✓ | — | — |
| bts | Batak Simalungun | ✓ | — | — | — | — | — |
| btx | Batak Karo | ✓ | — | — | — | — | — |
| bua | Buryat | ✓ | — | — | — | — | — |
| ca | Catalan | ✓ | — | ✓ | ✓ | — | — |
| ce | Chechen | ✓ | — | — | — | — | — |
| ceb | Cebuano | ✓ | — | — | ✓ | — | — |
| cgg | Kiga | ✓ | — | — | — | — | — |
| ch | Chamorro | ✓ | — | — | — | — | — |
| chk | Chuukese | ✓ | — | — | — | — | — |
| chm | Meadow Mari | ✓ | — | — | — | — | — |
| ckb | Kurdish (Sorani) | ✓ | — | — | — | — | — |
| cnh | Hakha Chin | ✓ | — | — | — | — | — |
| co | Corsican | ✓ | — | — | — | — | — |
| crh | Crimean Tatar | ✓ | — | — | — | — | — |
| crh-Latn | Crimean Tatar (Latin) | ✓ | — | — | — | — | — |
| crs | Seychellois Creole | ✓ | — | — | — | — | — |
| cs | Czech | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| cv | Chuvash | ✓ | — | — | ✓ | — | — |
| cy | Welsh | ✓ | — | ✓ | ✓ | — | — |
| da | Danish | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| de | German | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| din | Dinka | ✓ | — | — | — | — | — |
| doi | Dogri | ✓ | — | ✓ | — | — | — |
| dov | Dombe | ✓ | — | — | — | — | — |
| dsb | Lower Sorbian | — | — | ✓ | — | — | — |
| dv | Dhivehi | ✓ | — | ✓ | — | — | — |
| dyu | Dyula | ✓ | — | — | — | — | — |
| dz | Dzongkha | ✓ | — | — | — | — | — |
| ee | Ewe | ✓ | — | — | — | — | — |
| el | Greek | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| emj | Emoji | — | — | — | ✓ | — | — |
| en | English | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| en-GB | English (British) | ✓ | ✓ | — | — | — | — |
| en-US | English (American) | ✓ | ✓ | — | — | — | — |
| eo | Esperanto | ✓ | — | — | ✓ | — | — |
| es | Spanish | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| es-MX | Spanish (Mexico) | — | — | ✓ | — | — | — |
| et | Estonian | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| eu | Basque | ✓ | — | ✓ | ✓ | — | — |
| fa | Persian | ✓ | — | ✓ | ✓ | — | ✓ |
| fa-AF | Dari | ✓ | — | — | — | — | — |
| ff | Fulani | ✓ | — | — | — | — | — |
| fi | Finnish | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| fil | Filipino | ✓ | — | — | — | — | — |
| fj | Fijian | ✓ | — | ✓ | — | — | — |
| fo | Faroese | ✓ | — | ✓ | — | — | — |
| fon | Fon | ✓ | — | — | — | — | — |
| fr | French | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| fr-CA | French (Canada) | ✓ | — | ✓ | — | — | — |
| fur | Friulian | ✓ | — | — | — | — | — |
| fy | Frisian | ✓ | — | — | — | — | — |
| ga | Irish | ✓ | — | ✓ | ✓ | — | — |
| gaa | Ga | ✓ | — | — | — | — | — |
| gd | Scottish Gaelic | ✓ | — | — | ✓ | — | — |
| gl | Galician | ✓ | — | ✓ | ✓ | — | — |
| gn | Guarani | ✓ | — | — | — | — | — |
| gom | Konkani | ✓ | — | ✓ | — | — | — |
| gu | Gujarati | ✓ | — | ✓ | ✓ | — | — |
| gv | Manx | ✓ | — | — | — | — | — |
| ha | Hausa | ✓ | — | ✓ | — | — | — |
| haw | Hawaiian | ✓ | — | — | — | — | — |
| he | Hebrew | ✓ | ✓ | ✓ | ✓ | — | — |
| hi | Hindi | ✓ | — | ✓ | ✓ | — | ✓ |
| hil | Hiligaynon | ✓ | — | — | — | — | — |
| hmn | Hmong | ✓ | — | — | — | — | — |
| hne | Chhattisgarhi | — | — | ✓ | — | — | — |
| hr | Croatian | ✓ | — | ✓ | ✓ | — | — |
| hrx | Hunsrik | ✓ | — | — | — | — | — |
| hsb | Upper Sorbian | — | — | ✓ | — | — | — |
| ht | Haitian Creole | ✓ | — | ✓ | ✓ | — | — |
| hu | Hungarian | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| hy | Armenian | ✓ | — | ✓ | ✓ | — | — |
| iba | Iban | ✓ | — | — | — | — | — |
| id | Indonesian | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| ig | Igbo | ✓ | — | ✓ | — | — | — |
| ikt | Inuinnaqtun | — | — | ✓ | — | — | — |
| ilo | Ilocano | ✓ | — | — | — | — | — |
| is | Icelandic | ✓ | — | ✓ | ✓ | — | — |
| it | Italian | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| iu | Inuktitut | ✓ | — | ✓ | — | — | — |
| iu-Latn | Inuktitut (Latin) | ✓ | — | ✓ | — | — | — |
| ja | Japanese | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| jam | Jamaican Patois | ✓ | — | — | — | — | — |
| jv | Javanese | ✓ | — | — | ✓ | — | — |
| ka | Georgian | ✓ | — | ✓ | ✓ | — | — |
| kac | Jingpo | ✓ | — | — | — | — | — |
| kek | Qeqchi | ✓ | — | — | — | — | — |
| kg | Kikongo | ✓ | — | — | — | — | — |
| kha | Khasi | ✓ | — | — | — | — | — |
| kk | Kazakh | ✓ | — | ✓ | ✓ | — | — |
| kl | Kalaallisut | ✓ | — | — | — | — | — |
| km | Khmer | ✓ | — | ✓ | ✓ | — | — |
| kmr | Kurdish (Northern) | — | — | ✓ | — | — | — |
| kn | Kannada | ✓ | — | ✓ | ✓ | — | — |
| ko | Korean | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| kr | Kanuri | ✓ | — | — | — | — | — |
| kri | Krio | ✓ | — | — | — | — | — |
| ks | Kashmiri | — | — | ✓ | — | — | — |
| ktu | Kituba | ✓ | — | — | — | — | — |
| ku | Kurdish (Central) | ✓ | — | ✓ | — | — | — |
| kv | Komi | ✓ | — | — | — | — | — |
| ky | Kyrgyz | ✓ | — | ✓ | ✓ | — | — |
| la | Latin | ✓ | — | — | ✓ | — | — |
| lb | Luxembourgish | ✓ | — | ✓ | ✓ | — | — |
| lg | Luganda | ✓ | — | — | — | — | — |
| li | Limburgish | ✓ | — | — | — | — | — |
| lij | Ligurian | ✓ | — | — | — | — | — |
| lmo | Lombard | ✓ | — | — | — | — | — |
| ln | Lingala | ✓ | — | ✓ | — | — | — |
| lo | Lao | ✓ | — | ✓ | ✓ | — | — |
| lt | Lithuanian | ✓ | ✓ | ✓ | ✓ | — | — |
| ltg | Latgalian | ✓ | — | — | — | — | — |
| lua | Tshiluba | ✓ | — | — | — | — | — |
| lug | Ganda | — | — | ✓ | — | — | — |
| luo | Luo | ✓ | — | — | — | — | — |
| lus | Mizo | ✓ | — | — | — | — | — |
| lv | Latvian | ✓ | ✓ | ✓ | ✓ | — | — |
| lzh | Literary Chinese | — | — | ✓ | — | — | — |
| mad | Madurese | ✓ | — | — | — | — | — |
| mai | Maithili | ✓ | — | ✓ | — | — | — |
| mak | Makassar | ✓ | — | — | — | — | — |
| mam | Mam | ✓ | — | — | — | — | — |
| mfe | Mauritian Creole | ✓ | — | — | — | — | — |
| mg | Malagasy | ✓ | — | ✓ | ✓ | — | — |
| mh | Marshallese | ✓ | — | — | — | — | — |
| mhr | Meadow Mari | — | — | — | ✓ | — | — |
| mi | Maori | ✓ | — | ✓ | ✓ | — | — |
| min | Minang | ✓ | — | — | — | — | — |
| mk | Macedonian | ✓ | — | ✓ | ✓ | — | — |
| ml | Malayalam | ✓ | — | ✓ | ✓ | — | — |
| mn | Mongolian | ✓ | — | — | ✓ | — | — |
| mn-Cyrl | Mongolian (Cyrillic) | — | — | ✓ | — | — | — |
| mn-Mong | Mongolian (Traditional) | — | — | ✓ | — | — | — |
| mni | Manipuri | — | — | ✓ | — | — | — |
| mni-Mtei | Meiteilon (Manipuri) | ✓ | — | — | — | — | — |
| mr | Marathi | ✓ | — | ✓ | ✓ | — | — |
| mrj | Hill Mari | — | — | — | ✓ | — | — |
| ms | Malay | ✓ | — | ✓ | ✓ | — | — |
| ms-Arab | Malay (Jawi) | ✓ | — | — | — | — | — |
| mt | Maltese | ✓ | — | ✓ | ✓ | — | — |
| mwr | Marwadi | ✓ | — | — | — | — | — |
| mww | Hmong Daw | — | — | ✓ | — | — | — |
| my | Burmese | ✓ | — | ✓ | ✓ | — | — |
| nb | Norwegian Bokmål | — | — | ✓ | — | — | — |
| ndc-ZW | Ndau | ✓ | — | — | — | — | — |
| ne | Nepali | ✓ | — | ✓ | ✓ | — | — |
| new | Nepalbhasa (Newari) | ✓ | — | — | — | — | — |
| nhe | Nahuatl (Eastern Huasteca) | ✓ | — | — | — | — | — |
| nl | Dutch | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| no | Norwegian | ✓ | ✓ | ✓ | ✓ | — | — |
| nr | Ndebele (South) | ✓ | — | — | — | — | — |
| nso | Northern Sotho | ✓ | — | ✓ | — | — | — |
| nus | Nuer | ✓ | — | — | — | — | — |
| ny | Chichewa | ✓ | — | — | — | — | — |
| nya | Nyanja | — | — | ✓ | — | — | — |
| oc | Occitan | ✓ | — | — | — | — | — |
| om | Oromo | ✓ | — | — | — | — | — |
| or | Odia | ✓ | — | ✓ | — | — | — |
| os | Ossetian | ✓ | — | — | — | — | — |
| otq | Querétaro Otomi | — | — | ✓ | — | — | — |
| pa | Punjabi | ✓ | — | ✓ | ✓ | — | — |
| pa-Arab | Punjabi (Shahmukhi) | ✓ | — | — | — | — | — |
| pag | Pangasinan | ✓ | — | — | — | — | — |
| pam | Kapampangan | ✓ | — | — | — | — | — |
| pap | Papiamento | ✓ | — | — | ✓ | — | — |
| pl | Polish | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| prs | Dari | — | — | ✓ | — | — | — |
| ps | Pashto | ✓ | — | ✓ | — | — | — |
| pt | Portuguese | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| pt-BR | Portuguese (Brazil) | ✓ | ✓ | ✓ | — | — | — |
| pt-PT | Portuguese (Portugal) | ✓ | ✓ | ✓ | — | — | — |
| qu | Quechua | ✓ | — | — | — | — | — |
| rn | Rundi | ✓ | — | — | — | — | — |
| ro | Romanian | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| rom | Romani | ✓ | — | — | — | — | — |
| ru | Russian | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| run | Rundi | — | — | ✓ | — | — | — |
| rw | Kinyarwanda | ✓ | — | ✓ | — | — | — |
| sa | Sanskrit | ✓ | — | — | — | — | — |
| sah | Yakut | ✓ | — | — | ✓ | — | — |
| sat | Santali (Ol Chiki) | ✓ | — | — | — | — | — |
| sat-Latn | Santali (Latin) | ✓ | — | — | — | — | — |
| scn | Sicilian | ✓ | — | — | — | — | — |
| sd | Sindhi | ✓ | — | ✓ | — | — | — |
| se | Sami (North) | ✓ | — | — | — | — | — |
| sg | Sango | ✓ | — | — | — | — | — |
| shn | Shan | ✓ | — | — | — | — | — |
| si | Sinhala | ✓ | — | ✓ | ✓ | — | — |
| sjn | Sindarin | — | — | — | ✓ | — | — |
| sk | Slovak | ✓ | ✓ | ✓ | ✓ | — | — |
| sl | Slovenian | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| sm | Samoan | ✓ | — | ✓ | — | — | — |
| sn | Shona | ✓ | — | ✓ | — | — | — |
| so | Somali | ✓ | — | ✓ | — | — | — |
| sq | Albanian | ✓ | — | ✓ | ✓ | — | — |
| sr | Serbian | ✓ | — | — | ✓ | — | — |
| sr-Cyrl | Serbian (Cyrillic) | — | — | ✓ | — | — | — |
| sr-Latn | Serbian (Latin) | — | — | ✓ | — | — | — |
| ss | Swati | ✓ | — | — | — | — | — |
| st | Sesotho | ✓ | — | ✓ | — | — | — |
| su | Sundanese | ✓ | — | — | ✓ | — | — |
| sus | Susu | ✓ | — | — | — | — | — |
| sv | Swedish | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| sw | Swahili | ✓ | — | ✓ | ✓ | — | — |
| szl | Silesian | ✓ | — | — | — | — | — |
| ta | Tamil | ✓ | — | ✓ | ✓ | — | — |
| tcy | Tulu | ✓ | — | — | — | — | — |
| te | Telugu | ✓ | — | ✓ | ✓ | — | — |
| tet | Tetum | ✓ | — | — | — | — | — |
| tg | Tajik | ✓ | — | — | ✓ | — | — |
| th | Thai | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ti | Tigrinya | ✓ | — | ✓ | — | — | — |
| tiv | Tiv | ✓ | — | — | — | — | — |
| tk | Turkmen | ✓ | — | ✓ | — | — | — |
| tl | Tagalog | ✓ | — | ✓ | ✓ | — | — |
| tlh-Latn | Klingon (Latin) | — | — | ✓ | — | — | — |
| tlh-Piqd | Klingon (pIqaD) | — | — | ✓ | — | — | — |
| tn | Tswana | ✓ | — | ✓ | — | — | — |
| to | Tongan | ✓ | — | ✓ | — | — | — |
| tpi | Tok Pisin | ✓ | — | — | — | — | — |
| tr | Turkish | ✓ | ✓ | ✓ | ✓ | — | — |
| trp | Kokborok | ✓ | — | — | — | — | — |
| ts | Tsonga | ✓ | — | — | — | — | — |
| tt | Tatar | ✓ | — | ✓ | — | — | — |
| tum | Tumbuka | ✓ | — | — | — | — | — |
| ty | Tahitian | ✓ | — | ✓ | — | — | — |
| tyv | Tuvan | ✓ | — | — | — | — | — |
| udm | Udmurt | ✓ | — | — | ✓ | — | — |
| ug | Uyghur | ✓ | — | ✓ | — | — | — |
| uk | Ukrainian | ✓ | ✓ | ✓ | ✓ | — | — |
| ur | Urdu | ✓ | — | ✓ | ✓ | — | — |
| uz | Uzbek | ✓ | — | ✓ | ✓ | — | — |
| ve | Venda | ✓ | — | — | — | — | — |
| vec | Venetian | ✓ | — | — | — | — | — |
| vi | Vietnamese | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| war | Waray | ✓ | — | — | — | — | — |
| wo | Wolof | ✓ | — | — | — | — | — |
| wyw | Classical Chinese | — | — | — | — | ✓ | — |
| xh | Xhosa | ✓ | — | ✓ | ✓ | — | — |
| yi | Yiddish | ✓ | — | — | ✓ | — | — |
| yo | Yoruba | ✓ | — | ✓ | — | — | — |
| yua | Yucatec Maya | ✓ | — | ✓ | — | — | — |
| yue | Cantonese | ✓ | — | ✓ | — | ✓ | — |
| zap | Zapotec | ✓ | — | — | — | — | — |
| zh | Chinese | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| zh-CN | Chinese (Simplified) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| zh-Hans | Chinese (Simplified) | ✓ | ✓ | ✓ | — | — | — |
| zh-Hant | Chinese (Traditional) | ✓ | ✓ | ✓ | — | — | — |
| zh-TW | Chinese (Traditional) | ✓ | — | ✓ | — | ✓ | ✓ |
| zu | Zulu | ✓ | — | ✓ | — | — | — |


## License
MIT License

---

*Inspired by the [Mouse Tooltip Translator](https://chromewebstore.google.com/detail/mouse-tooltip-translator/hmigninkgibhdckiaphhmbgcghochdjc?hl=ja) Chrome extension.*
