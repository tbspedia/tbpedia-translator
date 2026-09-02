const {
  Plugin, PluginSettingTab, Setting, Notice, requestUrl, ItemView, Platform,
  parseYaml, stringifyYaml,
} = require('obsidian');
const nodeCrypto = require('crypto');

const DEFAULT_SETTINGS = {
  mouseoverEngine: 'google',
  selectionEngine: 'google',
  pageEngine: 'google',
  // Page controls dynamically use pageEngine by default, or keep a separate
  // engine choice for the next page translation.
  pageTranslationPanelEngine: 'pageEngine',
  // Translation Panel defaults to the Text Selection engine, but can keep a
  // separate on-the-fly engine choice.
  translationPanelEngine: 'selectionEngine',
  sourceLang: 'auto',
  targetLang: 'en',
  enableHover: true,
  enableSelection: true,
  enablePage: true,
  enableHoverMobile: true,
  enableSelectionMobile: true,
  enablePageMobile: true,
  textType: 'word',               // 'word' | 'sentence'
  delayMs: 500,
  showSourceText: false,
  showDetectedLang: false,
  showDictionary: true,
  showTransliteration: false,
  enabled: true,
  // When true, only react inside Obsidian note content (editor / preview / rendered embeds).
  // When false, react across the entire UI (sidebars, headers, etc.) — original behavior.
  restrictToNoteContent: true,
  // Which Obsidian view modes to react in (requires restrictToNoteContent: true).
  // 'edit'    : editor only (source / live preview)
  // 'reading' : reading view only
  // 'both'    : both (default)
  activeMode: 'both',
  // Suppress the tooltip when detected source language equals the target language.
  skipSameLanguage: true,
  // Stricter fallback: suppress when the translated text is identical to the input.
  // Helps when language detection is wrong (e.g. short tokens, proper nouns).
  skipIdenticalText: false,
  // When true, always call the translation API and never read from in-memory cache.
  disableCache: false,
  // 'system' | 'ja' | 'en' | 'fr' | 'es' | 'de' | 'nl' | 'sv' | 'ko' | 'zh-TW' | 'zh-CN' | 'vi' | 'id' | 'th'
  uiLang: 'system',
  // When true and page translation is showing, hover shows the pre-translation text
  // of the paragraph instead of running the normal word/sentence tooltip.
  pageTranslationHoverOriginal: true,
  // Retry a failed web engine with a compatible fallback (Google/Bing/Baidu).
  fallbackTranslatorEngine: true,
  // Translate human-readable string values in YAML when saving a translated note.
  translateYamlPropertyValues: false,
  // Reserved for vendor capability data fetched by future official API adapters.
  // Settings always keep the canonical BCP-47 code, never a vendor-specific code.
  languageCapabilityCache: {},
  // The feature engine whose capabilities drive the Translate From/To picker.
  languagePickerEngine: 'pageEngine',
  // OpenAI-compatible LLM with provider presets. Profiles retain their own
  // endpoint, key, and model so switching providers is non-destructive.
  llmProvider: 'custom',
  llmApiEndpoint: '',
  llmApiKey: '',
  llmModel: '',
  llmProviderSettings: {},
  // LLM engine settings
  ollamaApiUrl: 'http://localhost:11434',
  ollamaModel: '',
  ollamaPrompt: '',
  ollamaTemperature: 0,
  lmstudioApiUrl: 'http://localhost:1234',
  lmstudioModel: '',
  lmstudioPrompt: '',
  lmstudioTemperature: 0,
};

// ── i18n ─────────────────────────────────────────────────────────────────────
const STRINGS = {
  en: {
    // Tooltip
    origLabel: 'Original:',
    noTranslation: '(no translation)',
    // Vocab view
    vocabTitle: 'Vocabulary',
    vocabReload: 'Reload',
    sortByCount: 'By view count',
    sortByRecent: 'Recently viewed',
    sortAlpha: 'Alphabetical',
    filterAll: 'All',
    filterWord: 'Word',
    filterSentence: 'Sentence',
    vocabEmpty: 'No translation history',
    vocabCopy: 'Copy',
    vocabCopied: 'Copied!',
    copyTranslation: 'Copy translation',
    copyTranslationNotice: (text) => `Copied: ${text}`,
    copyTranslationNone: 'No translation to copy.',
    // Page translator
    pageAlreadyRunning: 'Page translation is already running.',
    pageNeedReadingView: 'Please switch to Reading View to translate the page.',
    pageNoText: 'No text found to translate.',
    pageTranslating: (cur, tot) => `Translating... ${cur}/${tot}`,
    pageCancel: 'Cancel',
    pageDone: (successful, failed, tot) => failed > 0
      ? `Page translation finished (${successful}/${tot} successful, ${failed} failed)`
      : `Page translation complete (${successful}/${tot} sections successful)`,
    pageRestoreReadingOnly: 'Page restore is only available in Reading View.',
    pageNoTranslated: 'No translated text found.',
    pageRestored: (n) => `Restored original text (${n} sections)`,
    pageSaveTranslated: 'Save translated page as new note',
    pageSaveDualLanguage: 'Save translated page as dual language note',
    pageSaved: (path) => `Saved translated page: ${path}`,
    pageDualSaved: (path) => `Saved dual language note: ${path}`,
    pageSaveFailed: 'Could not save the translated page. Check the console for details.',
    pageDualSaveFailed: 'Could not save the dual language note. Check the console for details.',
    pageSaveUnavailable: 'Translate this note in Reading View before saving it as a new note.',
    // Plugin actions
    pageDisabled: 'Page translation is disabled.',
    pluginToggle: (on) => `Mouse Tooltip Translator: ${on ? 'ON' : 'OFF'}`,
    // Ribbon / commands
    ribbonVocab: 'Open vocabulary list',
    ribbonPage: 'Translate page / Restore',
    // Settings headings
    settingsTitle: 'Mouse Tooltip Translator',
    secFeatures: 'Features',
    secDesktop: 'Desktop',
    secMobile: 'Mobile',
    secTranslation: 'Translation',
    secEngines: 'Engine Settings',
    secPerFeature: '🎯Per-feature Settings',
    secHoverSelection: 'Hover / Text Selection',
    secPage: 'Page Translation',
    secTooltip: 'Tooltip Contents',
    // Master toggle
    masterEnabled: 'Enabled',
    masterEnabledDesc: 'Master switch for the translator.',
    masterRestrict: 'Restrict to note content',
    masterRestrictDesc: 'Only react inside the note body (editor, preview, embeds). Turn off to translate anywhere in the Obsidian UI — sidebars, headings, settings, etc.',
    // Feature toggles
    featHover: 'Hover translation',
    featHoverDesc: 'Show a translation tooltip when hovering over text.',
    featSelection: 'Text selection translation',
    featSelectionDesc: 'Show a translation tooltip when text is selected.',
    featPage: 'Page translation',
    featPageDesc: 'Enable full-page translation via the ribbon button or command.',
    featHoverMobile: 'Tap translation',
    featHoverMobileDesc: 'Show a translation tooltip when tapping on a word.',
    featSelectionMobile: 'Selection translation',
    featSelectionMobileDesc: 'Show a translation tooltip when text is selected after a touch.',
    featPageMobile: 'Page translation',
    featPageMobileDesc: 'Enable full-page translation via the ribbon button or command.',
    // Translation settings
    translateFrom: 'Translate from',
    translateTo: 'Translate to',
    languageCatalogStatus: 'Language catalog status',
    languageCatalogDesc: 'The picker follows the selected feature engine. Changing an engine automatically switches the picker to that engine. Existing unsupported settings are retained and marked instead of being silently changed.',
    languagePickerEngine: 'Language picker engine',
    languagePickerEngineDesc: 'Choose which feature engine controls the Translate From/To lists.',
    languageUnsupportedSaved: 'Saved language not supported by the picker engine',
    languagePairUnsupported: (engine, source, target) => `${engine} does not support ${source} → ${target}. Choose a supported language pair in the plugin settings.`,
    skipSame: 'Skip same-language translations',
    skipSameDesc: "Hide the tooltip when the detected source language matches the target language (e.g. Japanese → Japanese).",
    skipIdentical: 'Skip identical translations',
    skipIdenticalDesc: 'Also hide the tooltip when the translated text is identical to the source text. Useful for short tokens, proper nouns, or code.',
    fallbackEngine: 'Automatic fallback engine',
    fallbackEngineDesc: 'When a supported web translation engine fails, retry with Google, Bing, or Baidu and temporarily bench the failed engine.',
    // Engine settings
    engineHover: 'Hover translation engine',
    engineHoverDesc: 'Engine to use when hovering.',
    engineSelection: 'Text translation engine',
    engineSelectionDesc: 'Engine to use for text selection.',
    enginePage: 'Page translation engine',
    enginePageDesc: 'Engine to use for full-page translation.',
    // LLM subsections
    llmOpenai: 'OpenAI-compatible API',
    llmOllama: 'Ollama',
    llmLmstudio: 'LM Studio',
    llmApiUrl: 'API URL',
    llmApiUrlDescOpenai: 'Base URL (e.g. https://api.openai.com)',
    llmApiUrlDescOllama: 'Ollama base URL (default: http://localhost:11434)',
    llmApiUrlDescLmstudio: 'LM Studio base URL (default: http://localhost:1234)',
    llmApiKey: 'API Key',
    llmModel: 'Model',
    llmModelDescOpenai: 'e.g. gpt-4o-mini, gpt-4o',
    llmModelDescOllama: 'e.g. llama3, mistral, gemma3',
    llmModelDescLmstudio: 'e.g. llama-3.2-3b-instruct',
    llmTemp: 'Temperature',
    llmTempDesc: 'Generation randomness. 0 = deterministic, 2 = maximum. Default: 0.0',
    llmPrompt: 'Prompt template',
    llmPromptDesc: 'Leave blank to use the default prompt. {{text}} is replaced with the source text, {{targetLang}} with the target language name.',
    llmProvider: 'Provider preset',
    llmProviderDesc: 'Select a hosted or local OpenAI-compatible provider preset, or configure a custom endpoint.',
    llmApiUrlDescLegacy: 'OpenAI-compatible base URL including its API version (for example, http://localhost:11434/v1).',
    llmModelDescLegacy: 'Enter a model name or fetch the models exposed by the endpoint.',
    llmFetchModels: 'Fetch available models',
    llmFetchNoEndpoint: 'Set an API URL first.',
    llmFetchNoModels: 'No models were returned by this endpoint.',
    llmFetchFailed: (message) => `Could not fetch LLM models: ${message}`,
    llmFetchOk: (count) => `Fetched ${count} models. Open the model field to select one.`,
    // Per-feature settings
    activeMode: 'Active mode',
    activeModeDesc: 'Select which Obsidian view mode to enable tooltip translation in.',
    modeBoth: 'Edit + Reading',
    modeEdit: 'Edit only',
    modeReading: 'Reading only',
    mouseUnit: 'Mouseover unit',
    mouseUnitDesc: 'Word picks one word under the cursor. Sentence expands to sentence boundary.',
    hoverDelay: 'Hover delay (ms)',
    hoverDelayDesc: 'Wait time before the tooltip is requested.',
    pageHoverOrig: 'Show original paragraph on hover during page translation',
    pageHoverOrigDesc: 'While page translation is active, disable normal hover/selection translation and show the pre-translation text of the hovered paragraph instead.',
    pageTranslateYaml: 'Translate YAML property values when saving',
    pageTranslationEngine: 'Page translation engine',
    pageTranslationEngineDefault: 'Use Page Translation engine',
    pageTranslateYamlDesc: 'Translate human-readable YAML string values during Translate current page and include them in the saved note. Property names, tags, links, dates, IDs, paths, numbers, booleans, and other machine-readable values remain unchanged.',
    pageTranslatingYaml: 'Translating YAML property values…',
    // Engine dropdown labels (for LLM engines)
    engOpenaiCompat: 'OpenAI Compatible API',
    engOllama: 'Ollama (local)',
    engLmstudio: 'LM Studio (local)',
    // Errors
    llmModelRequired: 'Model name is required. Please enter it in the plugin settings.',
    // Tooltip contents
    showDict: 'Show dictionary (POS) for single words',
    showDictDesc: 'When Google returns a bilingual dictionary, show "noun: ..." / "verb: ..." lines instead of the plain translation. Other engines do not return POS info.',
    unitWord: 'Word',
    unitSentence: 'Sentence',
    showTranslit: 'Show transliteration (romanization)',
    showTranslitDesc: 'Display the romanized reading of the source word (Google / Bing only).',
    showSource: 'Show source text',
    showDetected: 'Show detected language',
    uiLang: 'Interface language',
    uiLangDesc: 'Language used in the plugin settings UI.',
    uiLangSystem: 'Follow system',
    // Translation panel
    ribbonTrans: 'Open translation panel',
    ribbonGlossary: 'Open glossary',
    glossaryTitle: 'Glossary',
    glossaryReload: 'Reload glossary',
    glossaryEmpty: 'No active glossary terms',
    glossaryAliases: 'Aliases',
    glossaryMatch: 'Match',
    documentation: 'Documentation',
    documentationDesc: 'Read setup instructions and feature documentation on GitHub.',
    openDocumentation: 'Open documentation',
    transPanelTitle: 'Translation',
    transPanelEngine: 'Translation engine',
    transPanelEngineSelection: 'Use Text Selection engine',
    transPanelPlaceholder: 'Enter text to translate…',
    transPanelSwap: 'Swap languages',
    transPanelClear: 'Clear',
    transPanelCopy: 'Copy',
    transPanelCopied: 'Copied!',
  },
  ja: {
    origLabel: '原文:',
    noTranslation: '(翻訳なし)',
    vocabTitle: '単語帳',
    vocabReload: '再読み込み',
    sortByCount: '閲覧数順',
    sortByRecent: '最近見た順',
    sortAlpha: 'アルファベット順',
    filterAll: 'すべて',
    filterWord: '単語',
    filterSentence: '文',
    vocabEmpty: '翻訳履歴がありません',
    vocabCopy: 'コピー',
    vocabCopied: 'コピー済み',
    copyTranslation: '翻訳をコピー',
    copyTranslationNotice: (text) => `コピーしました: ${text}`,
    copyTranslationNone: 'コピーできる翻訳がありません。',
    // Page translator
    pageAlreadyRunning: 'ページ翻訳は既に実行中です。',
    pageNeedReadingView: 'ページ翻訳には閲覧モード（Reading View）に切り替えてください。',
    pageNoText: '翻訳するテキストが見つかりませんでした。',
    pageTranslating: (cur, tot) => `ページ翻訳中... ${cur}/${tot}`,
    pageCancel: 'キャンセル',
    pageDone: (successful, failed, tot) => failed > 0
      ? `ページ翻訳終了 (${tot}件中${successful}件成功、${failed}件失敗)`
      : `ページ翻訳完了 (${tot}件中${successful}件成功)`,
    pageRestoreReadingOnly: '閲覧モードでのみ復元できます。',
    pageNoTranslated: '翻訳済みのテキストが見つかりませんでした。',
    pageRestored: (n) => `元のテキストに復元しました (${n} セクション)`,
    pageSaveTranslated: '翻訳ページを新規ノートとして保存',
    pageSaved: (path) => `翻訳ページを保存しました: ${path}`,
    pageSaveFailed: '翻訳ページを保存できませんでした。詳細はコンソールを確認してください。',
    pageSaveUnavailable: '新規ノートとして保存する前に、このノートを閲覧モードで翻訳してください。',
    pageDisabled: 'ページ翻訳は無効になっています。',
    ribbonVocab: '単語帳を開く',
    ribbonPage: 'ページを翻訳 / 元に戻す',
    secFeatures: '機能の有効化/無効化',
    secDesktop: 'デスクトップ',
    secMobile: 'モバイル',
    secTranslation: '翻訳設定',
    secEngines: 'エンジン設定',
    secPerFeature: '🎯機能ごとの設定',
    secHoverSelection: 'ホバー翻訳 / テキスト選択翻訳',
    secPage: 'ページ翻訳',
    secTooltip: 'ツールチップ Contents',
    featHover: 'ホバー翻訳',
    featHoverDesc: 'マウスカーソルを合わせたときに翻訳ツールチップを表示します。',
    featSelection: 'テキスト選択翻訳',
    featSelectionDesc: 'テキストを選択したときに翻訳ツールチップを表示します。',
    featPage: 'ページ翻訳',
    featPageDesc: 'リボンボタンやコマンドからページ全体を翻訳する機能を有効にします。',
    featHoverMobile: 'タップ翻訳',
    featHoverMobileDesc: '単語をタップしたときに翻訳ツールチップを表示します。',
    featSelectionMobile: 'テキスト選択翻訳',
    featSelectionMobileDesc: 'タッチ後にテキストを選択したときに翻訳ツールチップを表示します。',
    featPageMobile: 'ページ翻訳',
    featPageMobileDesc: 'リボンボタンやコマンドからページ全体を翻訳する機能を有効にします。',
    skipSameDesc: '翻訳先と同じ言語が検出された場合にツールチップを非表示にします。',
    skipIdenticalDesc: '翻訳結果が原文と同一の場合もツールチップを非表示にします。短いトークン、固有名詞、コードなどに有効です。',
    engineHover: 'ホバー翻訳エンジン',
    engineHoverDesc: 'マウスカーソルを合わせたときに使うエンジン',
    engineSelection: 'テキスト翻訳エンジン',
    engineSelectionDesc: 'テキストを選択したときに使うエンジン',
    enginePage: 'ページ翻訳エンジン',
    enginePageDesc: 'ページ全体を翻訳するときに使うエンジン',
    llmOpenai: 'OpenAI互換API設定',
    llmOllama: 'Ollama設定',
    llmLmstudio: 'LM Studio設定',
    llmApiUrlDescOpenai: 'ベースURL（例: https://api.openai.com）',
    llmApiUrlDescOllama: 'OllamaのベースURL（デフォルト: http://localhost:11434）',
    llmApiUrlDescLmstudio: 'LM StudioのベースURL（デフォルト: http://localhost:1234）',
    llmModelDescOpenai: '例: gpt-4o-mini, gpt-4o',
    llmModelDescOllama: '例: llama3, mistral, gemma3',
    llmModelDescLmstudio: '例: llama-3.2-3b-instruct',
    llmTempDesc: '生成のランダム性。0 = 決定論的、2 = 最大ランダム。既定値: 0.0',
    llmPrompt: 'プロンプトテンプレート',
    llmPromptDesc: '空欄の場合はデフォルトのプロンプトを使用。{{text}} に原文、{{targetLang}} に翻訳先言語名が挿入されます。',
    activeMode: '適用するモード',
    activeModeDesc: 'ツールチップ翻訳を有効にするObsidianのビューモードを選択します。',
    modeBoth: '編集モード + リーディングモード',
    modeEdit: '編集モードのみ',
    modeReading: 'リーディングモードのみ',
    pageHoverOrig: '翻訳表示中は段落原文をホバー表示',
    pageHoverOrigDesc: 'ページ翻訳の結果を表示しているとき、通常のホバー翻訳・テキスト選択翻訳を無効にし、ホバーした段落の翻訳前テキストをツールチップに表示します。',
    pageTranslateYaml: '保存時にYAMLプロパティ値を翻訳',
    pageTranslateYamlDesc: '「現在のページを翻訳」の実行時に人が読むYAML文字列値を翻訳し、保存するノートに含めます。プロパティ名、タグ、リンク、日付、ID、パス、数値、真偽値などの機械可読値は変更しません。',
    pageTranslatingYaml: 'YAMLプロパティ値を翻訳中…',
    engOpenaiCompat: 'OpenAI互換API',
    engOllama: 'Ollama (ローカル)',
    engLmstudio: 'LM Studio (ローカル)',
    llmModelRequired: 'モデル名が未設定です。設定から入力してください。',
    masterEnabled: '有効',
    masterEnabledDesc: '翻訳機能のマスタースイッチ。',
    masterRestrict: 'ノートコンテンツ内に制限',
    masterRestrictDesc: 'ノート本文（エディター・プレビュー・埋め込み）内でのみ反応します。オフにすると、サイドバーや見出し、設定など Obsidian UI 全体で翻訳します。',
    translateFrom: '翻訳元言語',
    translateTo: '翻訳先言語',
    languageCatalogStatus: '言語カタログの状態',
    languageCatalogDesc: '言語選択は、選択された機能用エンジンに従います。エンジンを変更すると、そのエンジンに自動的に切り替わります。既存の非対応設定は自動変更せず、警告として表示します。',
    languagePickerEngine: '言語選択に使用するエンジン',
    languagePickerEngineDesc: '「翻訳元 / 翻訳先」のリストを制御する機能用エンジンを選択します。',
    languageUnsupportedSaved: '保存済みの言語は、言語選択用エンジンでサポートされていません',
    languagePairUnsupported: (engine, source, target) => `${engine} は ${source} → ${target} をサポートしていません。プラグイン設定で対応する言語ペアを選択してください。`,
    skipSame: '同一言語の翻訳をスキップ',
    skipSameDesc: '翻訳先と同じ言語が検出された場合にツールチップを非表示にします（例: 日本語 → 日本語）。',
    skipIdentical: '同一テキストの翻訳をスキップ',
    skipIdenticalDesc: '翻訳結果が原文と同一の場合もツールチップを非表示にします。短いトークン、固有名詞、コードなどに有効です。',
    unitWord: '単語',
    unitSentence: '文',
    mouseUnit: 'ホバー単位',
    mouseUnitDesc: '「単語」はカーソル直下の1語を取得します。「文」は文境界まで展開します。',
    hoverDelay: 'ホバー遅延 (ms)',
    hoverDelayDesc: 'ツールチップを表示するまでの待機時間。',
    secTooltip: 'ツールチップの内容',
    showDict: '単語の品詞（辞書）情報を表示',
    showDictDesc: 'Google が二言語辞書を返した場合、単純な翻訳の代わりに「名詞: ...」/「動詞: ...」形式で表示します。他のエンジンは品詞情報を返しません。',
    showTranslit: '転写（ローマ字読み）を表示',
    showTranslitDesc: '原語のローマ字読みを表示します（Google・Bing のみ）。',
    showSource: '原文を表示',
    showDetected: '検出言語を表示',
    uiLang: 'UI言語',
    uiLangDesc: 'プラグイン設定UIに使用する言語。',
    uiLangSystem: 'システムに従う',
    // Translation panel
    ribbonTrans: '翻訳パネルを開く',
    transPanelTitle: '翻訳',
    transPanelPlaceholder: '翻訳するテキストを入力…',
    transPanelSwap: '言語を入れ替え',
    transPanelClear: 'クリア',
    transPanelCopy: 'コピー',
    transPanelCopied: 'コピー済み',
  },
};

// Extra interface locales are merged over English, keeping future UI additions usable.
STRINGS['zh-TW'] = {
  autoDetect: '自動偵測', unsupportedByEngine: '所選引擎不支援', origLabel: '原文：', noTranslation: '（沒有翻譯）', vocabTitle: '單字庫', vocabReload: '重新載入', sortByCount: '依檢視次數', sortByRecent: '最近檢視', sortAlpha: '依字母排序', filterAll: '全部', filterWord: '單字', filterSentence: '句子', vocabEmpty: '沒有翻譯記錄', vocabCopy: '複製', vocabCopied: '已複製！', copyTranslation: '複製翻譯', copyTranslationNotice: (text) => `已複製：${text}`, copyTranslationNone: '沒有可複製的翻譯。',
  pageAlreadyRunning: '頁面翻譯正在進行中。', pageNeedReadingView: '請切換至閱讀檢視以翻譯頁面。', pageNoText: '找不到可翻譯的文字。', pageTranslating: (cur, tot) => `翻譯中… ${cur}/${tot}`, pageCancel: '取消', pageDone: (ok, fail, total) => fail ? `頁面翻譯完成（成功 ${ok}/${total}，失敗 ${fail}）` : `頁面翻譯完成（成功 ${ok}/${total} 個區段）`, pageRestoreReadingOnly: '只能在閱讀檢視中還原頁面。', pageNoTranslated: '找不到已翻譯的文字。', pageRestored: (n) => `已還原原文（${n} 個區段）`, pageSaveTranslated: '將翻譯頁面另存為新筆記', pageSaved: (path) => `已儲存翻譯頁面：${path}`, pageSaveFailed: '無法儲存翻譯頁面，請查看主控台。', pageSaveUnavailable: '請先在閱讀檢視中翻譯此筆記。', pageDisabled: '頁面翻譯已停用。', pluginToggle: (on) => `滑鼠提示翻譯：${on ? '開啟' : '關閉'}`,
  ribbonVocab: '開啟單字庫', ribbonPage: '翻譯頁面／還原', settingsTitle: '滑鼠提示翻譯', secFeatures: '功能', secDesktop: '桌面版', secMobile: '行動版', secTranslation: '翻譯設定', secEngines: '引擎設定', secPerFeature: '🎯各功能設定', secHoverSelection: '游標懸停／文字選取', secPage: '頁面翻譯', secTooltip: '提示框內容', masterEnabled: '啟用', masterEnabledDesc: '翻譯器的總開關。', masterRestrict: '僅限筆記內容', masterRestrictDesc: '只在筆記正文中運作；關閉後可翻譯整個 Obsidian 介面。', featHover: '游標懸停翻譯', featHoverDesc: '游標懸停在文字上時顯示翻譯提示。', featSelection: '文字選取翻譯', featSelectionDesc: '選取文字時顯示翻譯提示。', featPage: '頁面翻譯', featPageDesc: '透過功能區按鈕或命令翻譯整頁。', featHoverMobile: '點按翻譯', featHoverMobileDesc: '點按單字時顯示翻譯提示。', featSelectionMobile: '選取翻譯', featSelectionMobileDesc: '觸控選取文字後顯示翻譯提示。', featPageMobile: '頁面翻譯', featPageMobileDesc: '透過功能區按鈕或命令翻譯整頁。',
  translateFrom: '來源語言', translateTo: '目標語言', languageCatalogStatus: '語言目錄狀態', languageCatalogDesc: '語言清單會依所選功能的引擎調整；不支援的既有設定將保留並標示。', languagePickerEngine: '語言清單引擎', languagePickerEngineDesc: '選擇控制來源／目標語言清單的功能引擎。', languageUnsupportedSaved: '所選引擎不支援已儲存的語言', languagePairUnsupported: (engine, source, target) => `${engine} 不支援 ${source} → ${target}。請選擇支援的語言組合。`, skipSame: '略過相同語言', skipSameDesc: '來源與目標語言相同時隱藏提示。', skipIdentical: '略過相同文字', skipIdenticalDesc: '翻譯與原文相同時也隱藏提示。', engineHover: '懸停翻譯引擎', engineHoverDesc: '游標懸停時使用的引擎。', engineSelection: '文字翻譯引擎', engineSelectionDesc: '選取文字時使用的引擎。', enginePage: '頁面翻譯引擎', enginePageDesc: '翻譯整頁時使用的引擎。',
  llmOpenai: 'OpenAI 相容 API', llmOllama: 'Ollama 設定', llmLmstudio: 'LM Studio 設定', llmApiUrl: 'API 網址', llmApiUrlDescOpenai: '基礎網址（例如 https://api.openai.com）', llmApiUrlDescOllama: 'Ollama 基礎網址（預設：http://localhost:11434）', llmApiUrlDescLmstudio: 'LM Studio 基礎網址（預設：http://localhost:1234）', llmApiKey: 'API 金鑰', llmModel: '模型', llmModelDescOpenai: '例如 gpt-4o-mini、gpt-4o', llmModelDescOllama: '例如 llama3、mistral、gemma3', llmModelDescLmstudio: '例如 llama-3.2-3b-instruct', llmTemp: '溫度', llmTempDesc: '生成內容的隨機程度。0＝固定，2＝最大隨機。預設：0.0', llmPrompt: '提示詞範本', llmPromptDesc: '留空則使用預設提示詞。{{text}} 為原文，{{targetLang}} 為目標語言名稱。', activeMode: '作用模式', activeModeDesc: '選擇啟用提示翻譯的 Obsidian 檢視模式。', modeBoth: '編輯＋閱讀', modeEdit: '僅編輯', modeReading: '僅閱讀', mouseUnit: '懸停單位', mouseUnitDesc: '選擇游標下的單字或完整句子。', hoverDelay: '懸停延遲（毫秒）', hoverDelayDesc: '送出翻譯請求前的等待時間。', pageHoverOrig: '頁面翻譯時懸停顯示原始段落', pageHoverOrigDesc: '頁面翻譯啟用時，停用一般懸停／選取翻譯，並顯示段落翻譯前的文字。', pageTranslateYaml: '儲存時翻譯 YAML 屬性值', pageTranslateYamlDesc: '翻譯並儲存筆記時，同時翻譯可閱讀的 YAML 字串值；機器可讀值保持不變。', pageTranslatingYaml: '正在翻譯 YAML 屬性值…', engOpenaiCompat: 'OpenAI 相容 API', engOllama: 'Ollama（本機）', engLmstudio: 'LM Studio（本機）', llmModelRequired: '必須填寫模型名稱，請在外掛設定中輸入。', showDict: '顯示單字詞典（詞性）', showDictDesc: 'Google 傳回雙語詞典時顯示詞性資訊。', unitWord: '單字', unitSentence: '句子', showTranslit: '顯示轉寫（羅馬拼音）', showTranslitDesc: '顯示來源單字的羅馬拼音（僅 Google／Bing）。', showSource: '顯示原文', showDetected: '顯示偵測到的語言', uiLang: '介面語言', uiLangDesc: '外掛介面所使用的語言。', uiLangSystem: '跟隨系統', ribbonTrans: '開啟翻譯面板', transPanelTitle: '翻譯', transPanelPlaceholder: '輸入要翻譯的文字…', transPanelSwap: '交換語言', transPanelClear: '清除', transPanelCopy: '複製', transPanelCopied: '已複製！',
};

STRINGS['zh-CN'] = { ...STRINGS['zh-TW'], autoDetect: '自动检测', unsupportedByEngine: '所选引擎不支持', vocabTitle: '词汇表', vocabReload: '重新加载', filterWord: '单词', vocabEmpty: '没有翻译记录', vocabCopy: '复制', vocabCopied: '已复制！', copyTranslation: '复制翻译', pageNeedReadingView: '请切换到阅读视图以翻译页面。', pageNoText: '未找到可翻译的文本。', pageTranslating: (cur, tot) => `翻译中… ${cur}/${tot}`, pageSaveTranslated: '将翻译页面另存为新笔记', pageDisabled: '页面翻译已禁用。', ribbonVocab: '打开词汇表', ribbonPage: '翻译页面／还原', settingsTitle: '鼠标提示翻译', secDesktop: '桌面端', secMobile: '移动端', secTranslation: '翻译设置', secEngines: '引擎设置', secPerFeature: '🎯各功能设置', secHoverSelection: '鼠标悬停／文本选择', masterEnabled: '启用', masterEnabledDesc: '翻译器总开关。', masterRestrict: '仅限笔记内容', masterRestrictDesc: '仅在笔记正文中运行；关闭后可翻译整个 Obsidian 界面。', featHover: '悬停翻译', featHoverDesc: '鼠标悬停在文本上时显示翻译提示。', featSelection: '文本选择翻译', featSelectionDesc: '选择文本时显示翻译提示。', translateFrom: '源语言', translateTo: '目标语言', languageCatalogStatus: '语言目录状态', languagePickerEngine: '语言列表引擎', languagePickerEngineDesc: '选择控制源语言／目标语言列表的功能引擎。', skipSame: '跳过相同语言', skipSameDesc: '源语言与目标语言相同时隐藏提示。', skipIdentical: '跳过相同文本', engineHover: '悬停翻译引擎', engineSelection: '文本翻译引擎', enginePage: '页面翻译引擎', llmOllama: 'Ollama 设置', llmLmstudio: 'LM Studio 设置', llmApiUrl: 'API 网址', llmApiUrlDescOllama: 'Ollama 基础网址（默认：http://localhost:11434）', llmApiKey: 'API 密钥', llmModel: '模型', llmModelDescOllama: '例如 llama3、mistral、gemma3', llmTemp: '温度', llmTempDesc: '生成内容的随机程度。0＝固定，2＝最大随机。默认：0.0', llmPrompt: '提示词模板', llmPromptDesc: '留空则使用默认提示词。{{text}} 为原文，{{targetLang}} 为目标语言名称。', activeMode: '生效模式', modeBoth: '编辑＋阅读', modeEdit: '仅编辑', modeReading: '仅读取', mouseUnit: '悬停单位', hoverDelay: '悬停延迟（毫秒）', pageHoverOrig: '页面翻译时悬停显示原始段落', pageHoverOrigDesc: '页面翻译启用时，停用普通悬停／选择翻译，并显示段落翻译前的文本。', pageTranslateYaml: '保存时翻译 YAML 属性值', pageTranslateYamlDesc: '翻译并保存笔记时，同时翻译可阅读的 YAML 字符串值；机器可读值保持不变。', pageTranslatingYaml: '正在翻译 YAML 属性值…', unitWord: '单词', showDict: '显示单词词典（词性）', showSource: '显示原文', showDetected: '显示检测到的语言', uiLang: '界面语言', uiLangDesc: '插件界面使用的语言。', uiLangSystem: '跟随系统', ribbonTrans: '打开翻译面板', transPanelPlaceholder: '输入要翻译的文本…', transPanelSwap: '交换语言', transPanelClear: '清除', transPanelCopy: '复制', transPanelCopied: '已复制！' };

function makeSoutheastAsianLocale(values) { return { ...STRINGS.en, ...values }; }
STRINGS.fr = makeSoutheastAsianLocale({
  autoDetect: 'Détection automatique',
  unsupportedByEngine: 'non pris en charge par le moteur sélectionné',
  origLabel: 'Original :',
  noTranslation: '(aucune traduction)',
  vocabTitle: 'Vocabulaire',
  vocabReload: 'Recharger',
  sortByCount: 'Par nombre de consultations',
  sortByRecent: 'Consultés récemment',
  sortAlpha: 'Alphabétique',
  filterAll: 'Tous',
  filterWord: 'Mot',
  filterSentence: 'Phrase',
  vocabEmpty: 'Aucun historique de traduction',
  vocabCopy: 'Copier',
  vocabCopied: 'Copié !',
  copyTranslation: 'Copier la traduction',
  copyTranslationNotice: (text) => `Copié : ${text}`,
  copyTranslationNone: 'Aucune traduction à copier.',
  pageAlreadyRunning: 'La traduction de la page est déjà en cours.',
  pageNeedReadingView: 'Passez en mode Lecture pour traduire la page.',
  pageNoText: 'Aucun texte à traduire.',
  pageTranslating: (cur, tot) => `Traduction en cours… ${cur}/${tot}`,
  pageCancel: 'Annuler',
  pageDone: (successful, failed, tot) => failed > 0
    ? `Traduction de la page terminée (${successful}/${tot} réussies, ${failed} échouées)`
    : `Traduction de la page terminée (${successful}/${tot} sections réussies)`,
  pageRestoreReadingOnly: 'La restauration de la page est disponible uniquement en mode Lecture.',
  pageNoTranslated: 'Aucun texte traduit trouvé.',
  pageRestored: (n) => `Texte original restauré (${n} sections)`,
  pageSaveTranslated: 'Enregistrer la page traduite comme nouvelle note',
  pageSaved: (path) => `Page traduite enregistrée : ${path}`,
  pageSaveFailed: 'Impossible d’enregistrer la page traduite. Consultez la console pour plus de détails.',
  pageSaveUnavailable: 'Traduisez cette note en mode Lecture avant de l’enregistrer comme nouvelle note.',
  pageDisabled: 'La traduction de page est désactivée.',
  pluginToggle: (on) => `Traducteur d’infobulles : ${on ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`,
  ribbonVocab: 'Ouvrir la liste de vocabulaire',
  ribbonPage: 'Traduire la page / Restaurer',
  settingsTitle: 'Traducteur d’infobulles',
  secFeatures: 'Fonctionnalités',
  secDesktop: 'Ordinateur',
  secMobile: 'Mobile',
  secTranslation: 'Traduction',
  secEngines: 'Paramètres des moteurs',
  secPerFeature: '🎯Paramètres par fonctionnalité',
  secHoverSelection: 'Survol / Sélection de texte',
  secPage: 'Traduction de page',
  secTooltip: 'Contenu de l’infobulle',
  masterEnabled: 'Activé',
  masterEnabledDesc: 'Interrupteur principal du traducteur.',
  masterRestrict: 'Limiter au contenu des notes',
  masterRestrictDesc: 'Fonctionne uniquement dans le corps des notes. Désactivez cette option pour traduire partout dans l’interface d’Obsidian.',
  featHover: 'Traduction au survol',
  featHoverDesc: 'Afficher une infobulle de traduction au survol du texte.',
  featSelection: 'Traduction de la sélection',
  featSelectionDesc: 'Afficher une infobulle de traduction lorsque du texte est sélectionné.',
  featPage: 'Traduction de page',
  featPageDesc: 'Activer la traduction d’une page entière par le bouton du ruban ou une commande.',
  featHoverMobile: 'Traduction au toucher',
  featHoverMobileDesc: 'Afficher une infobulle de traduction en touchant un mot.',
  featSelectionMobile: 'Traduction de la sélection',
  featSelectionMobileDesc: 'Afficher une infobulle de traduction après une sélection tactile.',
  featPageMobile: 'Traduction de page',
  featPageMobileDesc: 'Activer la traduction d’une page entière par le bouton du ruban ou une commande.',
  translateFrom: 'Traduire depuis',
  translateTo: 'Traduire vers',
  languageCatalogStatus: 'État du catalogue de langues',
  languageCatalogDesc: 'Le sélecteur suit le moteur choisi pour la fonctionnalité. Modifier le moteur met automatiquement à jour le sélecteur. Les paramètres existants non pris en charge sont conservés et signalés.',
  languagePickerEngine: 'Moteur du sélecteur de langues',
  languagePickerEngineDesc: 'Choisissez le moteur qui détermine les listes « Traduire depuis/vers ».',
  languageUnsupportedSaved: 'La langue enregistrée n’est pas prise en charge par le moteur du sélecteur',
  languagePairUnsupported: (engine, source, target) => `${engine} ne prend pas en charge ${source} → ${target}. Choisissez une paire de langues prise en charge dans les paramètres du plugin.`,
  skipSame: 'Ignorer les traductions dans la même langue',
  skipSameDesc: 'Masquer l’infobulle lorsque la langue source détectée correspond à la langue cible.',
  skipIdentical: 'Ignorer les traductions identiques',
  skipIdenticalDesc: 'Masquer également l’infobulle lorsque le texte traduit est identique au texte source.',
  engineHover: 'Moteur de traduction au survol',
  engineHoverDesc: 'Moteur utilisé lors du survol.',
  engineSelection: 'Moteur de traduction de la sélection',
  engineSelectionDesc: 'Moteur utilisé pour la sélection de texte.',
  enginePage: 'Moteur de traduction de page',
  enginePageDesc: 'Moteur utilisé pour la traduction d’une page entière.',
  llmOpenai: 'API compatible OpenAI',
  llmOllama: 'Ollama',
  llmLmstudio: 'LM Studio',
  llmApiUrl: 'URL de l’API',
  llmApiUrlDescOpenai: 'URL de base (p. ex. https://api.openai.com)',
  llmApiUrlDescOllama: 'URL de base d’Ollama (par défaut : http://localhost:11434)',
  llmApiUrlDescLmstudio: 'URL de base de LM Studio (par défaut : http://localhost:1234)',
  llmApiKey: 'Clé API',
  llmModel: 'Modèle',
  llmModelDescOpenai: 'p. ex. gpt-4o-mini, gpt-4o',
  llmModelDescOllama: 'p. ex. llama3, mistral, gemma3',
  llmModelDescLmstudio: 'p. ex. llama-3.2-3b-instruct',
  llmTemp: 'Température',
  llmTempDesc: 'Aléa de génération. 0 = déterministe, 2 = maximum. Par défaut : 0,0.',
  llmPrompt: 'Modèle d’invite',
  llmPromptDesc: 'Laissez vide pour utiliser l’invite par défaut. {{text}} est remplacé par le texte source et {{targetLang}} par le nom de la langue cible.',
  activeMode: 'Mode actif',
  activeModeDesc: 'Choisissez les modes d’affichage d’Obsidian où activer la traduction par infobulle.',
  modeBoth: 'Édition + Lecture',
  modeEdit: 'Édition uniquement',
  modeReading: 'Lecture uniquement',
  mouseUnit: 'Unité de survol',
  mouseUnitDesc: 'Mot sélectionne le mot sous le curseur. Phrase étend la sélection jusqu’aux limites de la phrase.',
  hoverDelay: 'Délai de survol (ms)',
  hoverDelayDesc: 'Temps d’attente avant de demander l’infobulle.',
  pageHoverOrig: 'Afficher le paragraphe original au survol pendant la traduction de page',
  pageHoverOrigDesc: 'Lorsque la traduction de page est active, désactivez les traductions normales au survol et par sélection, puis affichez le texte original du paragraphe survolé.',
  pageTranslateYaml: 'Traduire les valeurs des propriétés YAML lors de l’enregistrement',
  pageTranslateYamlDesc: 'Traduire les valeurs textuelles YAML lisibles lors de la traduction de la page et les inclure dans la note enregistrée. Les noms de propriétés, étiquettes, liens, dates, identifiants, chemins, nombres, booléens et autres valeurs lisibles par machine restent inchangés.',
  pageTranslatingYaml: 'Traduction des valeurs de propriétés YAML…',
  engOpenaiCompat: 'API compatible OpenAI',
  engOllama: 'Ollama (local)',
  engLmstudio: 'LM Studio (local)',
  llmModelRequired: 'Le nom du modèle est requis. Saisissez-le dans les paramètres du plugin.',
  showDict: 'Afficher le dictionnaire (classe grammaticale) pour les mots isolés',
  showDictDesc: 'Lorsque Google renvoie un dictionnaire bilingue, afficher des lignes « nom : … » / « verbe : … » plutôt que la simple traduction.',
  unitWord: 'Mot',
  unitSentence: 'Phrase',
  showTranslit: 'Afficher la translittération (romanisation)',
  showTranslitDesc: 'Afficher la lecture romanisée du mot source (Google / Bing uniquement).',
  showSource: 'Afficher le texte source',
  showDetected: 'Afficher la langue détectée',
  uiLang: 'Langue de l’interface',
  uiLangDesc: 'Langue utilisée dans l’interface des paramètres du plugin.',
  uiLangSystem: 'Suivre le système',
  ribbonTrans: 'Ouvrir le panneau de traduction',
  transPanelTitle: 'Traduction',
  transPanelPlaceholder: 'Saisissez le texte à traduire…',
  transPanelSwap: 'Inverser les langues',
  transPanelClear: 'Effacer',
  transPanelCopy: 'Copier',
  transPanelCopied: 'Copié !',
});
STRINGS.es = makeSoutheastAsianLocale({
  autoDetect: 'Detectar automáticamente',
  unsupportedByEngine: 'no es compatible con el motor seleccionado',
  origLabel: 'Original:',
  noTranslation: '(sin traducción)',
  vocabTitle: 'Vocabulario',
  vocabReload: 'Recargar',
  sortByCount: 'Por número de consultas',
  sortByRecent: 'Visto recientemente',
  sortAlpha: 'Alfabético',
  filterAll: 'Todo',
  filterWord: 'Palabra',
  filterSentence: 'Oración',
  vocabEmpty: 'No hay historial de traducciones',
  vocabCopy: 'Copiar',
  vocabCopied: '¡Copiado!',
  copyTranslation: 'Copiar traducción',
  copyTranslationNotice: (text) => `Copiado: ${text}`,
  copyTranslationNone: 'No hay ninguna traducción que copiar.',
  pageAlreadyRunning: 'La traducción de la página ya está en curso.',
  pageNeedReadingView: 'Cambia a la vista de lectura para traducir la página.',
  pageNoText: 'No se encontró texto para traducir.',
  pageTranslating: (cur, tot) => `Traduciendo… ${cur}/${tot}`,
  pageCancel: 'Cancelar',
  pageDone: (successful, failed, tot) => failed > 0
    ? `Traducción de página terminada (${successful}/${tot} correctas, ${failed} fallidas)`
    : `Traducción de página terminada (${successful}/${tot} secciones correctas)`,
  pageRestoreReadingOnly: 'La restauración de la página solo está disponible en la vista de lectura.',
  pageNoTranslated: 'No se encontró texto traducido.',
  pageRestored: (n) => `Texto original restaurado (${n} secciones)`,
  pageSaveTranslated: 'Guardar la página traducida como nota nueva',
  pageSaved: (path) => `Página traducida guardada: ${path}`,
  pageSaveFailed: 'No se pudo guardar la página traducida. Consulta la consola para obtener más detalles.',
  pageSaveUnavailable: 'Traduce esta nota en la vista de lectura antes de guardarla como nota nueva.',
  pageDisabled: 'La traducción de páginas está desactivada.',
  pluginToggle: (on) => `Traductor de información emergente: ${on ? 'ACTIVADO' : 'DESACTIVADO'}`,
  ribbonVocab: 'Abrir lista de vocabulario',
  ribbonPage: 'Traducir página / Restaurar',
  settingsTitle: 'Traductor de información emergente',
  secFeatures: 'Funciones',
  secDesktop: 'Escritorio',
  secMobile: 'Móvil',
  secTranslation: 'Traducción',
  secEngines: 'Configuración de motores',
  secPerFeature: '🎯Configuración por función',
  secHoverSelection: 'Pasar el cursor / Selección de texto',
  secPage: 'Traducción de página',
  secTooltip: 'Contenido de la información emergente',
  masterEnabled: 'Activado',
  masterEnabledDesc: 'Interruptor principal del traductor.',
  masterRestrict: 'Restringir al contenido de las notas',
  masterRestrictDesc: 'Funciona solo dentro del cuerpo de las notas. Desactívalo para traducir en cualquier lugar de la interfaz de Obsidian.',
  featHover: 'Traducción al pasar el cursor',
  featHoverDesc: 'Mostrar una información emergente con la traducción al pasar el cursor sobre el texto.',
  featSelection: 'Traducción de texto seleccionado',
  featSelectionDesc: 'Mostrar una información emergente con la traducción cuando se seleccione texto.',
  featPage: 'Traducción de página',
  featPageDesc: 'Activar la traducción de una página completa mediante el botón de la cinta o un comando.',
  featHoverMobile: 'Traducción al tocar',
  featHoverMobileDesc: 'Mostrar una información emergente con la traducción al tocar una palabra.',
  featSelectionMobile: 'Traducción de selección',
  featSelectionMobileDesc: 'Mostrar una información emergente con la traducción tras una selección táctil.',
  featPageMobile: 'Traducción de página',
  featPageMobileDesc: 'Activar la traducción de una página completa mediante el botón de la cinta o un comando.',
  translateFrom: 'Traducir desde',
  translateTo: 'Traducir a',
  languageCatalogStatus: 'Estado del catálogo de idiomas',
  languageCatalogDesc: 'El selector sigue el motor de la función elegida. Al cambiar de motor, el selector cambia automáticamente a ese motor. Los ajustes existentes no compatibles se conservan y se marcan en lugar de modificarse sin aviso.',
  languagePickerEngine: 'Motor del selector de idiomas',
  languagePickerEngineDesc: 'Elige qué motor de función controla las listas «Traducir desde/a».',
  languageUnsupportedSaved: 'El idioma guardado no es compatible con el motor del selector',
  languagePairUnsupported: (engine, source, target) => `${engine} no admite ${source} → ${target}. Elige una combinación de idiomas compatible en los ajustes del complemento.`,
  skipSame: 'Omitir traducciones en el mismo idioma',
  skipSameDesc: 'Ocultar la información emergente cuando el idioma de origen detectado coincida con el idioma de destino.',
  skipIdentical: 'Omitir traducciones idénticas',
  skipIdenticalDesc: 'Ocultar también la información emergente cuando el texto traducido sea idéntico al texto de origen.',
  engineHover: 'Motor de traducción al pasar el cursor',
  engineHoverDesc: 'Motor que se usa al pasar el cursor.',
  engineSelection: 'Motor de traducción de texto',
  engineSelectionDesc: 'Motor que se usa para la selección de texto.',
  enginePage: 'Motor de traducción de página',
  enginePageDesc: 'Motor que se usa para traducir una página completa.',
  llmOpenai: 'API compatible con OpenAI',
  llmOllama: 'Ollama',
  llmLmstudio: 'LM Studio',
  llmApiUrl: 'URL de la API',
  llmApiUrlDescOpenai: 'URL base (p. ej., https://api.openai.com)',
  llmApiUrlDescOllama: 'URL base de Ollama (predeterminada: http://localhost:11434)',
  llmApiUrlDescLmstudio: 'URL base de LM Studio (predeterminada: http://localhost:1234)',
  llmApiKey: 'Clave de API',
  llmModel: 'Modelo',
  llmModelDescOpenai: 'p. ej., gpt-4o-mini, gpt-4o',
  llmModelDescOllama: 'p. ej., llama3, mistral, gemma3',
  llmModelDescLmstudio: 'p. ej., llama-3.2-3b-instruct',
  llmTemp: 'Temperatura',
  llmTempDesc: 'Aleatoriedad de la generación. 0 = determinista, 2 = máxima. Predeterminado: 0,0.',
  llmPrompt: 'Plantilla de instrucciones',
  llmPromptDesc: 'Déjalo en blanco para usar las instrucciones predeterminadas. {{text}} se reemplaza por el texto de origen y {{targetLang}} por el nombre del idioma de destino.',
  activeMode: 'Modo activo',
  activeModeDesc: 'Selecciona los modos de vista de Obsidian en los que se habilita la traducción mediante información emergente.',
  modeBoth: 'Edición + Lectura',
  modeEdit: 'Solo edición',
  modeReading: 'Solo lectura',
  mouseUnit: 'Unidad al pasar el cursor',
  mouseUnitDesc: 'Palabra selecciona una palabra bajo el cursor. Oración se extiende hasta el límite de la oración.',
  hoverDelay: 'Retraso al pasar el cursor (ms)',
  hoverDelayDesc: 'Tiempo de espera antes de solicitar la información emergente.',
  pageHoverOrig: 'Mostrar el párrafo original al pasar el cursor durante la traducción de página',
  pageHoverOrigDesc: 'Mientras la traducción de página está activa, desactiva la traducción normal al pasar el cursor y mediante selección, y muestra el texto anterior a la traducción del párrafo señalado.',
  pageTranslateYaml: 'Traducir los valores de propiedades YAML al guardar',
  pageTranslateYamlDesc: 'Traduce los valores de texto YAML legibles durante la traducción de la página y los incluye en la nota guardada. Los nombres de propiedades, etiquetas, enlaces, fechas, identificadores, rutas, números, valores booleanos y otros valores legibles por máquina no cambian.',
  pageTranslatingYaml: 'Traduciendo valores de propiedades YAML…',
  engOpenaiCompat: 'API compatible con OpenAI',
  engOllama: 'Ollama (local)',
  engLmstudio: 'LM Studio (local)',
  llmModelRequired: 'Se requiere el nombre del modelo. Introdúcelo en los ajustes del complemento.',
  showDict: 'Mostrar diccionario (categoría gramatical) para palabras individuales',
  showDictDesc: 'Cuando Google devuelve un diccionario bilingüe, muestra líneas «sustantivo: …» / «verbo: …» en lugar de la traducción simple.',
  unitWord: 'Palabra',
  unitSentence: 'Oración',
  showTranslit: 'Mostrar transliteración (romanización)',
  showTranslitDesc: 'Mostrar la lectura romanizada de la palabra de origen (solo Google / Bing).',
  showSource: 'Mostrar texto de origen',
  showDetected: 'Mostrar idioma detectado',
  uiLang: 'Idioma de la interfaz',
  uiLangDesc: 'Idioma utilizado en la interfaz de ajustes del complemento.',
  uiLangSystem: 'Seguir el sistema',
  ribbonTrans: 'Abrir panel de traducción',
  transPanelTitle: 'Traducción',
  transPanelPlaceholder: 'Introduce el texto que deseas traducir…',
  transPanelSwap: 'Intercambiar idiomas',
  transPanelClear: 'Borrar',
  transPanelCopy: 'Copiar',
  transPanelCopied: '¡Copiado!',
});
STRINGS.ko = makeSoutheastAsianLocale({
  autoDetect: '자동 감지',
  unsupportedByEngine: '선택한 엔진에서 지원하지 않음',
  origLabel: '원문:',
  noTranslation: '(번역 없음)',
  vocabTitle: '단어장',
  vocabReload: '새로 고침',
  sortByCount: '조회 수순',
  sortByRecent: '최근 조회순',
  sortAlpha: '가나다순',
  filterAll: '전체',
  filterWord: '단어',
  filterSentence: '문장',
  vocabEmpty: '번역 기록이 없습니다',
  vocabCopy: '복사',
  vocabCopied: '복사됨!',
  copyTranslation: '번역 복사',
  copyTranslationNotice: (text) => `복사됨: ${text}`,
  copyTranslationNone: '복사할 번역이 없습니다.',
  pageAlreadyRunning: '페이지 번역이 이미 진행 중입니다.',
  pageNeedReadingView: '페이지를 번역하려면 읽기 보기로 전환하세요.',
  pageNoText: '번역할 텍스트를 찾을 수 없습니다.',
  pageTranslating: (cur, tot) => `번역 중… ${cur}/${tot}`,
  pageCancel: '취소',
  pageDone: (successful, failed, tot) => failed > 0
    ? `페이지 번역 완료 (${successful}/${tot}개 성공, ${failed}개 실패)`
    : `페이지 번역 완료 (${successful}/${tot}개 섹션 성공)`,
  pageRestoreReadingOnly: '페이지 복원은 읽기 보기에서만 사용할 수 있습니다.',
  pageNoTranslated: '번역된 텍스트를 찾을 수 없습니다.',
  pageRestored: (n) => `원문 복원 완료 (${n}개 섹션)`,
  pageSaveTranslated: '번역한 페이지를 새 노트로 저장',
  pageSaved: (path) => `번역한 페이지 저장됨: ${path}`,
  pageSaveFailed: '번역한 페이지를 저장할 수 없습니다. 자세한 내용은 콘솔을 확인하세요.',
  pageSaveUnavailable: '새 노트로 저장하기 전에 읽기 보기에서 이 노트를 번역하세요.',
  pageDisabled: '페이지 번역이 비활성화되어 있습니다.',
  pluginToggle: (on) => `마우스 툴팁 번역기: ${on ? '켜짐' : '꺼짐'}`,
  ribbonVocab: '단어장 열기',
  ribbonPage: '페이지 번역 / 복원',
  settingsTitle: '마우스 툴팁 번역기',
  secFeatures: '기능',
  secDesktop: '데스크톱',
  secMobile: '모바일',
  secTranslation: '번역',
  secEngines: '엔진 설정',
  secPerFeature: '🎯기능별 설정',
  secHoverSelection: '마우스 오버 / 텍스트 선택',
  secPage: '페이지 번역',
  secTooltip: '툴팁 내용',
  masterEnabled: '활성화',
  masterEnabledDesc: '번역기의 기본 스위치입니다.',
  masterRestrict: '노트 내용으로 제한',
  masterRestrictDesc: '노트 본문에서만 작동합니다. 이 옵션을 끄면 Obsidian 인터페이스 어디에서나 번역합니다.',
  featHover: '마우스 오버 번역',
  featHoverDesc: '텍스트 위에 마우스를 올리면 번역 툴팁을 표시합니다.',
  featSelection: '텍스트 선택 번역',
  featSelectionDesc: '텍스트를 선택하면 번역 툴팁을 표시합니다.',
  featPage: '페이지 번역',
  featPageDesc: '리본 버튼 또는 명령으로 전체 페이지 번역을 활성화합니다.',
  featHoverMobile: '탭 번역',
  featHoverMobileDesc: '단어를 탭하면 번역 툴팁을 표시합니다.',
  featSelectionMobile: '선택 번역',
  featSelectionMobileDesc: '터치로 텍스트를 선택하면 번역 툴팁을 표시합니다.',
  featPageMobile: '페이지 번역',
  featPageMobileDesc: '리본 버튼 또는 명령으로 전체 페이지 번역을 활성화합니다.',
  translateFrom: '번역할 언어',
  translateTo: '번역될 언어',
  languageCatalogStatus: '언어 목록 상태',
  languageCatalogDesc: '선택기는 선택한 기능 엔진을 따릅니다. 엔진을 변경하면 선택기도 해당 엔진으로 자동 전환됩니다. 기존의 지원되지 않는 설정은 자동으로 변경하지 않고 유지 및 표시합니다.',
  languagePickerEngine: '언어 선택 엔진',
  languagePickerEngineDesc: '번역할 언어/번역될 언어 목록을 제어할 기능 엔진을 선택하세요.',
  languageUnsupportedSaved: '저장된 언어는 언어 선택 엔진에서 지원하지 않습니다',
  languagePairUnsupported: (engine, source, target) => `${engine}은(는) ${source} → ${target}을(를) 지원하지 않습니다. 플러그인 설정에서 지원되는 언어 쌍을 선택하세요.`,
  skipSame: '동일 언어 번역 건너뛰기',
  skipSameDesc: '감지된 원본 언어가 대상 언어와 같으면 툴팁을 숨깁니다.',
  skipIdentical: '동일한 번역 건너뛰기',
  skipIdenticalDesc: '번역된 텍스트가 원문과 동일한 경우에도 툴팁을 숨깁니다.',
  engineHover: '마우스 오버 번역 엔진',
  engineHoverDesc: '마우스를 올릴 때 사용할 엔진입니다.',
  engineSelection: '텍스트 번역 엔진',
  engineSelectionDesc: '텍스트 선택에 사용할 엔진입니다.',
  enginePage: '페이지 번역 엔진',
  enginePageDesc: '전체 페이지 번역에 사용할 엔진입니다.',
  llmOpenai: 'OpenAI 호환 API',
  llmOllama: 'Ollama',
  llmLmstudio: 'LM Studio',
  llmApiUrl: 'API URL',
  llmApiUrlDescOpenai: '기본 URL(예: https://api.openai.com)',
  llmApiUrlDescOllama: 'Ollama 기본 URL(기본값: http://localhost:11434)',
  llmApiUrlDescLmstudio: 'LM Studio 기본 URL(기본값: http://localhost:1234)',
  llmApiKey: 'API 키',
  llmModel: '모델',
  llmModelDescOpenai: '예: gpt-4o-mini, gpt-4o',
  llmModelDescOllama: '예: llama3, mistral, gemma3',
  llmModelDescLmstudio: '예: llama-3.2-3b-instruct',
  llmTemp: '온도',
  llmTempDesc: '생성 무작위성입니다. 0 = 결정적, 2 = 최대. 기본값: 0.0',
  llmPrompt: '프롬프트 템플릿',
  llmPromptDesc: '기본 프롬프트를 사용하려면 비워 두세요. {{text}}는 원문으로, {{targetLang}}는 대상 언어 이름으로 바뀝니다.',
  activeMode: '활성 모드',
  activeModeDesc: '툴팁 번역을 활성화할 Obsidian 보기 모드를 선택하세요.',
  modeBoth: '편집 + 읽기',
  modeEdit: '편집만',
  modeReading: '읽기만',
  mouseUnit: '마우스 오버 단위',
  mouseUnitDesc: '단어는 커서 아래의 한 단어를 선택합니다. 문장은 문장 경계까지 확장합니다.',
  hoverDelay: '마우스 오버 지연 시간(ms)',
  hoverDelayDesc: '툴팁을 요청하기 전 대기 시간입니다.',
  pageHoverOrig: '페이지 번역 중 마우스 오버 시 원본 단락 표시',
  pageHoverOrigDesc: '페이지 번역이 활성화되어 있을 때 일반 마우스 오버/선택 번역을 비활성화하고, 마우스를 올린 단락의 번역 전 텍스트를 표시합니다.',
  pageTranslateYaml: '저장할 때 YAML 속성 값 번역',
  pageTranslateYamlDesc: '페이지를 번역할 때 사람이 읽을 수 있는 YAML 문자열 값을 번역하여 저장된 노트에 포함합니다. 속성 이름, 태그, 링크, 날짜, ID, 경로, 숫자, 불리언 등 기계가 읽는 값은 변경되지 않습니다.',
  pageTranslatingYaml: 'YAML 속성 값을 번역하는 중…',
  engOpenaiCompat: 'OpenAI 호환 API',
  engOllama: 'Ollama (로컬)',
  engLmstudio: 'LM Studio (로컬)',
  llmModelRequired: '모델 이름이 필요합니다. 플러그인 설정에서 입력하세요.',
  showDict: '단일 단어에 사전(품사) 표시',
  showDictDesc: 'Google이 이중 언어 사전을 반환하면 단순 번역 대신 "명사: ..." / "동사: ..." 줄을 표시합니다.',
  unitWord: '단어',
  unitSentence: '문장',
  showTranslit: '음역(로마자 표기) 표시',
  showTranslitDesc: '원본 단어의 로마자 읽기를 표시합니다(Google / Bing만 해당).',
  showSource: '원문 표시',
  showDetected: '감지된 언어 표시',
  uiLang: '인터페이스 언어',
  uiLangDesc: '플러그인 설정 인터페이스에 사용할 언어입니다.',
  uiLangSystem: '시스템 설정 따르기',
  ribbonTrans: '번역 패널 열기',
  transPanelTitle: '번역',
  transPanelPlaceholder: '번역할 텍스트를 입력하세요…',
  transPanelSwap: '언어 바꾸기',
  transPanelClear: '지우기',
  transPanelCopy: '복사',
  transPanelCopied: '복사됨!',
});
STRINGS.de = makeSoutheastAsianLocale({
  autoDetect: 'Automatisch erkennen', unsupportedByEngine: 'wird von der ausgewählten Engine nicht unterstützt', origLabel: 'Original:', noTranslation: '(keine Übersetzung)',
  vocabTitle: 'Vokabular', vocabReload: 'Neu laden', sortByCount: 'Nach Aufrufzahl', sortByRecent: 'Zuletzt angesehen', sortAlpha: 'Alphabetisch', filterAll: 'Alle', filterWord: 'Wort', filterSentence: 'Satz', vocabEmpty: 'Kein Übersetzungsverlauf', vocabCopy: 'Kopieren', vocabCopied: 'Kopiert!', copyTranslation: 'Übersetzung kopieren', copyTranslationNotice: (text) => `Kopiert: ${text}`, copyTranslationNone: 'Keine Übersetzung zum Kopieren.',
  pageAlreadyRunning: 'Die Seitenübersetzung läuft bereits.', pageNeedReadingView: 'Wechsle zur Leseansicht, um die Seite zu übersetzen.', pageNoText: 'Kein zu übersetzender Text gefunden.', pageTranslating: (cur, tot) => `Übersetzen… ${cur}/${tot}`, pageCancel: 'Abbrechen', pageDone: (successful, failed, tot) => failed > 0 ? `Seitenübersetzung beendet (${successful}/${tot} erfolgreich, ${failed} fehlgeschlagen)` : `Seitenübersetzung abgeschlossen (${successful}/${tot} Abschnitte erfolgreich)`, pageRestoreReadingOnly: 'Die Seitenwiederherstellung ist nur in der Leseansicht verfügbar.', pageNoTranslated: 'Kein übersetzter Text gefunden.', pageRestored: (n) => `Originaltext wiederhergestellt (${n} Abschnitte)`, pageSaveTranslated: 'Übersetzte Seite als neue Notiz speichern', pageSaved: (path) => `Übersetzte Seite gespeichert: ${path}`, pageSaveFailed: 'Die übersetzte Seite konnte nicht gespeichert werden. Weitere Details findest du in der Konsole.', pageSaveUnavailable: 'Übersetze diese Notiz in der Leseansicht, bevor du sie als neue Notiz speicherst.', pageDisabled: 'Die Seitenübersetzung ist deaktiviert.', pluginToggle: (on) => `Maus-Tooltip-Übersetzer: ${on ? 'EIN' : 'AUS'}`,
  ribbonVocab: 'Vokabelliste öffnen', ribbonPage: 'Seite übersetzen / Wiederherstellen', settingsTitle: 'Maus-Tooltip-Übersetzer', secFeatures: 'Funktionen', secDesktop: 'Desktop', secMobile: 'Mobil', secTranslation: 'Übersetzung', secEngines: 'Engine-Einstellungen', secPerFeature: '🎯Einstellungen pro Funktion', secHoverSelection: 'Überfahren / Textauswahl', secPage: 'Seitenübersetzung', secTooltip: 'Tooltip-Inhalt', masterEnabled: 'Aktiviert', masterEnabledDesc: 'Hauptschalter für den Übersetzer.', masterRestrict: 'Auf Notizinhalte beschränken', masterRestrictDesc: 'Funktioniert nur im Notizinhalt. Deaktiviere dies, um überall in der Obsidian-Oberfläche zu übersetzen.', featHover: 'Übersetzung beim Überfahren', featHoverDesc: 'Beim Überfahren von Text einen Übersetzungs-Tooltip anzeigen.', featSelection: 'Übersetzung der Textauswahl', featSelectionDesc: 'Bei ausgewähltem Text einen Übersetzungs-Tooltip anzeigen.', featPage: 'Seitenübersetzung', featPageDesc: 'Übersetzung einer ganzen Seite über die Menüleiste oder einen Befehl aktivieren.', featHoverMobile: 'Übersetzung beim Antippen', featHoverMobileDesc: 'Beim Antippen eines Wortes einen Übersetzungs-Tooltip anzeigen.', featSelectionMobile: 'Übersetzung der Auswahl', featSelectionMobileDesc: 'Nach einer Touch-Auswahl einen Übersetzungs-Tooltip anzeigen.', featPageMobile: 'Seitenübersetzung', featPageMobileDesc: 'Übersetzung einer ganzen Seite über die Menüleiste oder einen Befehl aktivieren.',
  translateFrom: 'Übersetzen von', translateTo: 'Übersetzen nach', languageCatalogStatus: 'Status des Sprachkatalogs', languageCatalogDesc: 'Die Auswahl folgt der für die Funktion gewählten Engine. Beim Wechsel der Engine wechselt auch die Auswahl automatisch. Nicht unterstützte vorhandene Einstellungen bleiben erhalten und werden markiert.', languagePickerEngine: 'Engine für die Sprachauswahl', languagePickerEngineDesc: 'Wähle, welche Funktions-Engine die Listen „Übersetzen von/nach“ bestimmt.', languageUnsupportedSaved: 'Die gespeicherte Sprache wird von der Auswahl-Engine nicht unterstützt', languagePairUnsupported: (engine, source, target) => `${engine} unterstützt ${source} → ${target} nicht. Wähle in den Plugin-Einstellungen ein unterstütztes Sprachpaar.`, skipSame: 'Übersetzungen gleicher Sprache überspringen', skipSameDesc: 'Tooltip ausblenden, wenn die erkannte Ausgangssprache der Zielsprache entspricht.', skipIdentical: 'Identische Übersetzungen überspringen', skipIdenticalDesc: 'Tooltip auch ausblenden, wenn übersetzter und ursprünglicher Text identisch sind.', engineHover: 'Engine für Übersetzung beim Überfahren', engineHoverDesc: 'Engine für das Überfahren mit der Maus.', engineSelection: 'Engine für Textübersetzung', engineSelectionDesc: 'Engine für die Textauswahl.', enginePage: 'Engine für Seitenübersetzung', enginePageDesc: 'Engine für die Übersetzung einer ganzen Seite.',
  llmOpenai: 'OpenAI-kompatible API', llmOllama: 'Ollama', llmLmstudio: 'LM Studio', llmApiUrl: 'API-URL', llmApiUrlDescOpenai: 'Basis-URL (z. B. https://api.openai.com)', llmApiUrlDescOllama: 'Ollama-Basis-URL (Standard: http://localhost:11434)', llmApiUrlDescLmstudio: 'LM-Studio-Basis-URL (Standard: http://localhost:1234)', llmApiKey: 'API-Schlüssel', llmModel: 'Modell', llmModelDescOpenai: 'z. B. gpt-4o-mini, gpt-4o', llmModelDescOllama: 'z. B. llama3, mistral, gemma3', llmModelDescLmstudio: 'z. B. llama-3.2-3b-instruct', llmTemp: 'Temperatur', llmTempDesc: 'Zufälligkeit der Generierung. 0 = deterministisch, 2 = maximal. Standard: 0,0.', llmPrompt: 'Prompt-Vorlage', llmPromptDesc: 'Leer lassen, um die Standardvorlage zu verwenden. {{text}} wird durch den Ausgangstext und {{targetLang}} durch den Namen der Zielsprache ersetzt.', activeMode: 'Aktiver Modus', activeModeDesc: 'Wähle, in welchen Obsidian-Ansichtsmodi die Tooltip-Übersetzung aktiv ist.', modeBoth: 'Bearbeiten + Lesen', modeEdit: 'Nur Bearbeiten', modeReading: 'Nur Lesen', mouseUnit: 'Einheit beim Überfahren', mouseUnitDesc: 'Wort wählt das Wort unter dem Cursor. Satz erweitert bis zur Satzgrenze.', hoverDelay: 'Verzögerung beim Überfahren (ms)', hoverDelayDesc: 'Wartezeit vor der Tooltip-Anfrage.', pageHoverOrig: 'Originalabsatz beim Überfahren während der Seitenübersetzung anzeigen', pageHoverOrigDesc: 'Während die Seitenübersetzung aktiv ist, normale Überfahr- und Auswahlübersetzungen deaktivieren und den Text vor der Übersetzung für den überfahrenen Absatz anzeigen.', pageTranslateYaml: 'YAML-Eigenschaftswerte beim Speichern übersetzen', pageTranslateYamlDesc: 'Lesbare YAML-Zeichenfolgen beim Übersetzen der Seite übersetzen und in die gespeicherte Notiz aufnehmen. Eigenschaftsnamen, Tags, Links, Daten, IDs, Pfade, Zahlen, Wahrheitswerte und andere maschinenlesbare Werte bleiben unverändert.', pageTranslatingYaml: 'YAML-Eigenschaftswerte werden übersetzt…', engOpenaiCompat: 'OpenAI-kompatible API', engOllama: 'Ollama (lokal)', engLmstudio: 'LM Studio (lokal)', llmModelRequired: 'Der Modellname ist erforderlich. Gib ihn in den Plugin-Einstellungen ein.',
  showDict: 'Wörterbuch (Wortart) für einzelne Wörter anzeigen', showDictDesc: 'Wenn Google ein zweisprachiges Wörterbuch zurückgibt, Zeilen wie „Substantiv: …“ / „Verb: …“ statt der einfachen Übersetzung anzeigen.', unitWord: 'Wort', unitSentence: 'Satz', showTranslit: 'Transliteration (Romanisierung) anzeigen', showTranslitDesc: 'Die romanisierte Lesung des Ausgangsworts anzeigen (nur Google / Bing).', showSource: 'Ausgangstext anzeigen', showDetected: 'Erkannte Sprache anzeigen', uiLang: 'Oberflächensprache', uiLangDesc: 'Sprache der Plugin-Einstellungsoberfläche.', uiLangSystem: 'Systemeinstellung verwenden', ribbonTrans: 'Übersetzungsbereich öffnen', transPanelTitle: 'Übersetzung', transPanelPlaceholder: 'Zu übersetzenden Text eingeben…', transPanelSwap: 'Sprachen tauschen', transPanelClear: 'Leeren', transPanelCopy: 'Kopieren', transPanelCopied: 'Kopiert!',
});
STRINGS.nl = makeSoutheastAsianLocale({
  autoDetect: 'Automatisch detecteren', unsupportedByEngine: 'wordt niet ondersteund door de geselecteerde engine', origLabel: 'Origineel:', noTranslation: '(geen vertaling)',
  vocabTitle: 'Woordenschat', vocabReload: 'Opnieuw laden', sortByCount: 'Op weergaveaantal', sortByRecent: 'Recent bekeken', sortAlpha: 'Alfabetisch', filterAll: 'Alles', filterWord: 'Woord', filterSentence: 'Zin', vocabEmpty: 'Geen vertaalgeschiedenis', vocabCopy: 'Kopiëren', vocabCopied: 'Gekopieerd!', copyTranslation: 'Vertaling kopiëren', copyTranslationNotice: (text) => `Gekopieerd: ${text}`, copyTranslationNone: 'Geen vertaling om te kopiëren.',
  pageAlreadyRunning: 'Paginavertaling is al bezig.', pageNeedReadingView: 'Schakel over naar de leesweergave om de pagina te vertalen.', pageNoText: 'Geen te vertalen tekst gevonden.', pageTranslating: (cur, tot) => `Vertalen… ${cur}/${tot}`, pageCancel: 'Annuleren', pageDone: (successful, failed, tot) => failed > 0 ? `Paginavertaling voltooid (${successful}/${tot} geslaagd, ${failed} mislukt)` : `Paginavertaling voltooid (${successful}/${tot} secties geslaagd)`, pageRestoreReadingOnly: 'Pagina herstellen is alleen beschikbaar in de leesweergave.', pageNoTranslated: 'Geen vertaalde tekst gevonden.', pageRestored: (n) => `Oorspronkelijke tekst hersteld (${n} secties)`, pageSaveTranslated: 'Vertaalde pagina opslaan als nieuwe notitie', pageSaved: (path) => `Vertaalde pagina opgeslagen: ${path}`, pageSaveFailed: 'De vertaalde pagina kon niet worden opgeslagen. Bekijk de console voor meer informatie.', pageSaveUnavailable: 'Vertaal deze notitie in de leesweergave voordat je hem als nieuwe notitie opslaat.', pageDisabled: 'Paginavertaling is uitgeschakeld.', pluginToggle: (on) => `Muis-tooltipvertaler: ${on ? 'AAN' : 'UIT'}`,
  ribbonVocab: 'Woordenlijst openen', ribbonPage: 'Pagina vertalen / Herstellen', settingsTitle: 'Muis-tooltipvertaler', secFeatures: 'Functies', secDesktop: 'Desktop', secMobile: 'Mobiel', secTranslation: 'Vertaling', secEngines: 'Engine-instellingen', secPerFeature: '🎯Instellingen per functie', secHoverSelection: 'Aanwijzen / Tekst selecteren', secPage: 'Paginavertaling', secTooltip: 'Tooltipinhoud', masterEnabled: 'Ingeschakeld', masterEnabledDesc: 'Hoofdschakelaar voor de vertaler.', masterRestrict: 'Beperken tot notitie-inhoud', masterRestrictDesc: 'Werkt alleen binnen de notitie-inhoud. Schakel dit uit om overal in de Obsidian-interface te vertalen.', featHover: 'Vertaling bij aanwijzen', featHoverDesc: 'Een vertaaltooltip weergeven wanneer je de aanwijzer op tekst plaatst.', featSelection: 'Vertaling van geselecteerde tekst', featSelectionDesc: 'Een vertaaltooltip weergeven wanneer tekst is geselecteerd.', featPage: 'Paginavertaling', featPageDesc: 'Vertaling van een hele pagina inschakelen via de lintknop of een opdracht.', featHoverMobile: 'Vertaling bij tikken', featHoverMobileDesc: 'Een vertaaltooltip weergeven wanneer je op een woord tikt.', featSelectionMobile: 'Vertaling van selectie', featSelectionMobileDesc: 'Een vertaaltooltip weergeven na een aanraakselectie.', featPageMobile: 'Paginavertaling', featPageMobileDesc: 'Vertaling van een hele pagina inschakelen via de lintknop of een opdracht.',
  translateFrom: 'Vertalen van', translateTo: 'Vertalen naar', languageCatalogStatus: 'Status van de taalcatalogus', languageCatalogDesc: 'De keuzelijst volgt de engine van de gekozen functie. Als je van engine wisselt, wisselt de keuzelijst automatisch mee. Bestaande niet-ondersteunde instellingen blijven behouden en worden gemarkeerd.', languagePickerEngine: 'Engine voor taalkiezer', languagePickerEngineDesc: 'Kies welke functie-engine de lijsten Vertalen van/naar beheert.', languageUnsupportedSaved: 'De opgeslagen taal wordt niet ondersteund door de engine van de taalkiezer', languagePairUnsupported: (engine, source, target) => `${engine} ondersteunt ${source} → ${target} niet. Kies een ondersteund talenpaar in de plugininstellingen.`, skipSame: 'Vertalingen in dezelfde taal overslaan', skipSameDesc: 'Tooltip verbergen wanneer de gedetecteerde brontaal overeenkomt met de doeltaal.', skipIdentical: 'Identieke vertalingen overslaan', skipIdenticalDesc: 'Tooltip ook verbergen wanneer de vertaalde tekst gelijk is aan de brontekst.', engineHover: 'Vertaalengine bij aanwijzen', engineHoverDesc: 'Engine die wordt gebruikt bij aanwijzen.', engineSelection: 'Tekstvertaalengine', engineSelectionDesc: 'Engine die wordt gebruikt voor tekstselectie.', enginePage: 'Paginavertaalengine', enginePageDesc: 'Engine die wordt gebruikt om een hele pagina te vertalen.',
  llmOpenai: 'OpenAI-compatibele API', llmOllama: 'Ollama', llmLmstudio: 'LM Studio', llmApiUrl: 'API-URL', llmApiUrlDescOpenai: 'Basis-URL (bijv. https://api.openai.com)', llmApiUrlDescOllama: 'Ollama-basis-URL (standaard: http://localhost:11434)', llmApiUrlDescLmstudio: 'LM Studio-basis-URL (standaard: http://localhost:1234)', llmApiKey: 'API-sleutel', llmModel: 'Model', llmModelDescOpenai: 'bijv. gpt-4o-mini, gpt-4o', llmModelDescOllama: 'bijv. llama3, mistral, gemma3', llmModelDescLmstudio: 'bijv. llama-3.2-3b-instruct', llmTemp: 'Temperatuur', llmTempDesc: 'Willekeurigheid van de generatie. 0 = deterministisch, 2 = maximaal. Standaard: 0,0.', llmPrompt: 'Promptsjabloon', llmPromptDesc: 'Laat leeg om de standaardprompt te gebruiken. {{text}} wordt vervangen door de brontekst en {{targetLang}} door de naam van de doeltaal.', activeMode: 'Actieve modus', activeModeDesc: 'Kies in welke Obsidian-weergavemodi tooltipvertaling actief is.', modeBoth: 'Bewerken + Lezen', modeEdit: 'Alleen bewerken', modeReading: 'Alleen lezen', mouseUnit: 'Eenheid bij aanwijzen', mouseUnitDesc: 'Woord kiest één woord onder de cursor. Zin breidt uit tot de zinsgrens.', hoverDelay: 'Vertraging bij aanwijzen (ms)', hoverDelayDesc: 'Wachttijd voordat de tooltip wordt aangevraagd.', pageHoverOrig: 'Oorspronkelijke alinea tonen bij aanwijzen tijdens paginavertaling', pageHoverOrigDesc: 'Wanneer paginavertaling actief is, normale vertaling bij aanwijzen en selectie uitschakelen en de tekst van vóór de vertaling van de aangewezen alinea tonen.', pageTranslateYaml: 'YAML-eigenschapswaarden vertalen bij opslaan', pageTranslateYamlDesc: 'Leesbare YAML-tekenreekswaarden vertalen tijdens de paginavertaling en opnemen in de opgeslagen notitie. Eigenschapsnamen, tags, links, datums, ID’s, paden, getallen, booleaanse waarden en andere machineleesbare waarden blijven ongewijzigd.', pageTranslatingYaml: 'YAML-eigenschapswaarden vertalen…', engOpenaiCompat: 'OpenAI-compatibele API', engOllama: 'Ollama (lokaal)', engLmstudio: 'LM Studio (lokaal)', llmModelRequired: 'Modelnaam is vereist. Vul deze in bij de plugininstellingen.',
  showDict: 'Woordenboek (woordsoort) voor losse woorden tonen', showDictDesc: 'Wanneer Google een tweetalig woordenboek terugstuurt, regels zoals „zelfstandig naamwoord: …” / „werkwoord: …” tonen in plaats van de gewone vertaling.', unitWord: 'Woord', unitSentence: 'Zin', showTranslit: 'Transliteratie (romanisering) tonen', showTranslitDesc: 'De geromaniseerde uitspraak van het bronwoord tonen (alleen Google / Bing).', showSource: 'Brontekst tonen', showDetected: 'Gedetecteerde taal tonen', uiLang: 'Interfacetaal', uiLangDesc: 'Taal die wordt gebruikt in de plugininstellingen.', uiLangSystem: 'Systeeminstelling volgen', ribbonTrans: 'Vertaalpaneel openen', transPanelTitle: 'Vertaling', transPanelPlaceholder: 'Voer tekst in om te vertalen…', transPanelSwap: 'Talen wisselen', transPanelClear: 'Wissen', transPanelCopy: 'Kopiëren', transPanelCopied: 'Gekopieerd!',
});
STRINGS.sv = makeSoutheastAsianLocale({
  autoDetect: 'Identifiera automatiskt', unsupportedByEngine: 'stöds inte av den valda motorn', origLabel: 'Original:', noTranslation: '(ingen översättning)',
  vocabTitle: 'Ordförråd', vocabReload: 'Ladda om', sortByCount: 'Efter visningsantal', sortByRecent: 'Nyligen visade', sortAlpha: 'Alfabetiskt', filterAll: 'Alla', filterWord: 'Ord', filterSentence: 'Mening', vocabEmpty: 'Ingen översättningshistorik', vocabCopy: 'Kopiera', vocabCopied: 'Kopierat!', copyTranslation: 'Kopiera översättning', copyTranslationNotice: (text) => `Kopierat: ${text}`, copyTranslationNone: 'Ingen översättning att kopiera.',
  pageAlreadyRunning: 'Sidöversättning körs redan.', pageNeedReadingView: 'Byt till läsvyn för att översätta sidan.', pageNoText: 'Ingen text att översätta hittades.', pageTranslating: (cur, tot) => `Översätter… ${cur}/${tot}`, pageCancel: 'Avbryt', pageDone: (successful, failed, tot) => failed > 0 ? `Sidöversättning klar (${successful}/${tot} lyckades, ${failed} misslyckades)` : `Sidöversättning klar (${successful}/${tot} avsnitt lyckades)`, pageRestoreReadingOnly: 'Återställning av sidan är endast tillgänglig i läsvyn.', pageNoTranslated: 'Ingen översatt text hittades.', pageRestored: (n) => `Originaltexten återställdes (${n} avsnitt)`, pageSaveTranslated: 'Spara översatt sida som ny anteckning', pageSaved: (path) => `Översatt sida sparad: ${path}`, pageSaveFailed: 'Det gick inte att spara den översatta sidan. Se konsolen för mer information.', pageSaveUnavailable: 'Översätt den här anteckningen i läsvyn innan du sparar den som en ny anteckning.', pageDisabled: 'Sidöversättning är inaktiverad.', pluginToggle: (on) => `Musverktygstipsöversättare: ${on ? 'PÅ' : 'AV'}`,
  ribbonVocab: 'Öppna ordlista', ribbonPage: 'Översätt sida / Återställ', settingsTitle: 'Musverktygstipsöversättare', secFeatures: 'Funktioner', secDesktop: 'Dator', secMobile: 'Mobil', secTranslation: 'Översättning', secEngines: 'Motorinställningar', secPerFeature: '🎯Inställningar per funktion', secHoverSelection: 'Hovra / Textmarkering', secPage: 'Sidöversättning', secTooltip: 'Innehåll i verktygstips', masterEnabled: 'Aktiverad', masterEnabledDesc: 'Huvudströmbrytare för översättaren.', masterRestrict: 'Begränsa till anteckningsinnehåll', masterRestrictDesc: 'Fungerar endast i anteckningens innehåll. Stäng av detta för att översätta var som helst i Obsidians gränssnitt.', featHover: 'Översättning vid hovring', featHoverDesc: 'Visa ett översättningsverktygstips när muspekaren hålls över text.', featSelection: 'Översättning av textmarkering', featSelectionDesc: 'Visa ett översättningsverktygstips när text markeras.', featPage: 'Sidöversättning', featPageDesc: 'Aktivera översättning av en hel sida via menyknappen eller ett kommando.', featHoverMobile: 'Översättning vid tryck', featHoverMobileDesc: 'Visa ett översättningsverktygstips när du trycker på ett ord.', featSelectionMobile: 'Översättning av markering', featSelectionMobileDesc: 'Visa ett översättningsverktygstips efter en pekmarkering.', featPageMobile: 'Sidöversättning', featPageMobileDesc: 'Aktivera översättning av en hel sida via menyknappen eller ett kommando.',
  translateFrom: 'Översätt från', translateTo: 'Översätt till', languageCatalogStatus: 'Status för språkkatalog', languageCatalogDesc: 'Väljaren följer motorn för den valda funktionen. När motorn ändras växlar väljaren automatiskt till den motorn. Befintliga inställningar som inte stöds behålls och markeras i stället för att ändras utan förvarning.', languagePickerEngine: 'Motor för språkväljare', languagePickerEngineDesc: 'Välj vilken funktionsmotor som styr listorna Översätt från/till.', languageUnsupportedSaved: 'Det sparade språket stöds inte av språkväljarens motor', languagePairUnsupported: (engine, source, target) => `${engine} stöder inte ${source} → ${target}. Välj ett språkpar som stöds i plugininställningarna.`, skipSame: 'Hoppa över översättningar på samma språk', skipSameDesc: 'Dölj verktygstipset när det upptäckta källspråket matchar målspråket.', skipIdentical: 'Hoppa över identiska översättningar', skipIdenticalDesc: 'Dölj även verktygstipset när den översatta texten är identisk med källtexten.', engineHover: 'Översättningsmotor vid hovring', engineHoverDesc: 'Motor som används vid hovring.', engineSelection: 'Textöversättningsmotor', engineSelectionDesc: 'Motor som används för textmarkering.', enginePage: 'Motor för sidöversättning', enginePageDesc: 'Motor som används för att översätta en hel sida.',
  llmOpenai: 'OpenAI-kompatibelt API', llmOllama: 'Ollama', llmLmstudio: 'LM Studio', llmApiUrl: 'API-URL', llmApiUrlDescOpenai: 'Bas-URL (t.ex. https://api.openai.com)', llmApiUrlDescOllama: 'Ollamas bas-URL (standard: http://localhost:11434)', llmApiUrlDescLmstudio: 'LM Studios bas-URL (standard: http://localhost:1234)', llmApiKey: 'API-nyckel', llmModel: 'Modell', llmModelDescOpenai: 't.ex. gpt-4o-mini, gpt-4o', llmModelDescOllama: 't.ex. llama3, mistral, gemma3', llmModelDescLmstudio: 't.ex. llama-3.2-3b-instruct', llmTemp: 'Temperatur', llmTempDesc: 'Slumpmässighet i genereringen. 0 = deterministisk, 2 = maximal. Standard: 0,0.', llmPrompt: 'Promptmall', llmPromptDesc: 'Lämna tomt för att använda standardprompten. {{text}} ersätts med källtexten och {{targetLang}} med namnet på målspråket.', activeMode: 'Aktivt läge', activeModeDesc: 'Välj i vilka Obsidian-vylägen verktygstipsöversättning ska vara aktiv.', modeBoth: 'Redigera + Läsa', modeEdit: 'Endast redigering', modeReading: 'Endast läsning', mouseUnit: 'Enhet vid hovring', mouseUnitDesc: 'Ord väljer ett ord under markören. Mening utökar till meningsgränsen.', hoverDelay: 'Fördröjning vid hovring (ms)', hoverDelayDesc: 'Väntetid före begäran om verktygstips.', pageHoverOrig: 'Visa originalstycke vid hovring under sidöversättning', pageHoverOrigDesc: 'När sidöversättning är aktiv, inaktivera normal översättning vid hovring och markering och visa texten före översättningen för det stycke som muspekaren hålls över.', pageTranslateYaml: 'Översätt YAML-egenskapsvärden vid sparande', pageTranslateYamlDesc: 'Översätt läsbara YAML-strängvärden under sidöversättningen och inkludera dem i den sparade anteckningen. Egenskapsnamn, taggar, länkar, datum, ID:n, sökvägar, tal, booleska och andra maskinläsbara värden förblir oförändrade.', pageTranslatingYaml: 'Översätter YAML-egenskapsvärden…', engOpenaiCompat: 'OpenAI-kompatibelt API', engOllama: 'Ollama (lokal)', engLmstudio: 'LM Studio (lokal)', llmModelRequired: 'Modellnamn krävs. Ange det i plugininställningarna.',
  showDict: 'Visa ordbok (ordklass) för enskilda ord', showDictDesc: 'När Google returnerar en tvåspråkig ordbok visas rader som ”substantiv: …” / ”verb: …” i stället för den vanliga översättningen.', unitWord: 'Ord', unitSentence: 'Mening', showTranslit: 'Visa translitterering (romanisering)', showTranslitDesc: 'Visa den romaniserade läsningen av källordet (endast Google / Bing).', showSource: 'Visa källtext', showDetected: 'Visa upptäckt språk', uiLang: 'Gränssnittsspråk', uiLangDesc: 'Språket som används i plugininställningarnas gränssnitt.', uiLangSystem: 'Följ systemet', ribbonTrans: 'Öppna översättningspanel', transPanelTitle: 'Översättning', transPanelPlaceholder: 'Ange text att översätta…', transPanelSwap: 'Byt språk', transPanelClear: 'Rensa', transPanelCopy: 'Kopiera', transPanelCopied: 'Kopierat!',
});
STRINGS.vi = makeSoutheastAsianLocale({ autoDetect: 'Tự động phát hiện', unsupportedByEngine: 'không được bộ máy đã chọn hỗ trợ', origLabel: 'Bản gốc:', noTranslation: '(không có bản dịch)', vocabTitle: 'Từ vựng', vocabReload: 'Tải lại', filterAll: 'Tất cả', filterWord: 'Từ', filterSentence: 'Câu', vocabEmpty: 'Chưa có lịch sử dịch', vocabCopy: 'Sao chép', vocabCopied: 'Đã sao chép!', pageNeedReadingView: 'Vui lòng chuyển sang chế độ Đọc để dịch trang.', pageNoText: 'Không tìm thấy văn bản để dịch.', pageTranslating: (cur, tot) => `Đang dịch… ${cur}/${tot}`, pageCancel: 'Hủy', pageDisabled: 'Đã tắt dịch trang.', ribbonVocab: 'Mở danh sách từ vựng', ribbonPage: 'Dịch trang / Khôi phục', settingsTitle: 'Trình dịch chú giải chuột', secFeatures: 'Tính năng', secDesktop: 'Máy tính', secMobile: 'Di động', secTranslation: 'Dịch thuật', secEngines: 'Cài đặt bộ máy', secPerFeature: '🎯Cài đặt từng tính năng', secHoverSelection: 'Di chuột / Chọn văn bản', secPage: 'Dịch trang', secTooltip: 'Nội dung chú giải', masterEnabled: 'Bật', masterEnabledDesc: 'Công tắc chính của trình dịch.', masterRestrict: 'Chỉ trong nội dung ghi chú', masterRestrictDesc: 'Chỉ hoạt động trong nội dung ghi chú.', featHover: 'Dịch khi di chuột', featHoverDesc: 'Hiển thị bản dịch khi di chuột lên văn bản.', featSelection: 'Dịch văn bản đã chọn', featSelectionDesc: 'Hiển thị bản dịch khi chọn văn bản.', featPage: 'Dịch trang', featPageDesc: 'Bật dịch toàn trang.', translateFrom: 'Dịch từ', translateTo: 'Dịch sang', languageCatalogStatus: 'Trạng thái danh mục ngôn ngữ', languagePickerEngine: 'Bộ máy danh sách ngôn ngữ', languagePickerEngineDesc: 'Chọn bộ máy điều khiển danh sách ngôn ngữ nguồn/đích.', skipSame: 'Bỏ qua cùng ngôn ngữ', skipSameDesc: 'Ẩn chú giải khi ngôn ngữ nguồn và đích giống nhau.', skipIdentical: 'Bỏ qua bản dịch giống hệt', engineHover: 'Bộ máy dịch khi di chuột', engineSelection: 'Bộ máy dịch văn bản', enginePage: 'Bộ máy dịch trang', llmOllama: 'Cài đặt Ollama', llmApiUrl: 'URL API', llmApiUrlDescOllama: 'URL cơ sở Ollama (mặc định: http://localhost:11434)', llmApiKey: 'Khóa API', llmModel: 'Mô hình', llmModelDescOllama: 'ví dụ: llama3, mistral, gemma3', llmTemp: 'Nhiệt độ', llmTempDesc: 'Độ ngẫu nhiên khi tạo. 0 = cố định, 2 = tối đa. Mặc định: 0.0', llmPrompt: 'Mẫu lời nhắc', llmPromptDesc: 'Để trống để dùng lời nhắc mặc định. {{text}} là văn bản nguồn, {{targetLang}} là ngôn ngữ đích.', activeMode: 'Chế độ hoạt động', modeBoth: 'Chỉnh sửa + Đọc', modeEdit: 'Chỉ chỉnh sửa', modeReading: 'Chỉ đọc', mouseUnit: 'Đơn vị di chuột', hoverDelay: 'Độ trễ di chuột (ms)', pageHoverOrig: 'Hiện đoạn gốc khi di chuột trong lúc dịch trang', pageHoverOrigDesc: 'Khi dịch trang, hiện văn bản gốc của đoạn thay cho bản dịch di chuột thông thường.', pageTranslateYaml: 'Dịch giá trị thuộc tính YAML khi lưu', pageTranslateYamlDesc: 'Dịch các giá trị YAML dễ đọc khi dịch và lưu ghi chú; các giá trị máy đọc được không đổi.', pageTranslatingYaml: 'Đang dịch giá trị thuộc tính YAML…', unitWord: 'Từ', unitSentence: 'Câu', showDict: 'Hiển thị từ điển (từ loại)', showTranslit: 'Hiển thị phiên âm', showSource: 'Hiển thị văn bản gốc', showDetected: 'Hiển thị ngôn ngữ nhận diện', uiLang: 'Ngôn ngữ giao diện', uiLangDesc: 'Ngôn ngữ dùng trong giao diện plugin.', uiLangSystem: 'Theo hệ thống', ribbonTrans: 'Mở bảng dịch', transPanelTitle: 'Dịch', transPanelPlaceholder: 'Nhập văn bản cần dịch…', transPanelSwap: 'Đổi ngôn ngữ', transPanelClear: 'Xóa', transPanelCopy: 'Sao chép', transPanelCopied: 'Đã sao chép!' });
STRINGS.id = makeSoutheastAsianLocale({ autoDetect: 'Deteksi otomatis', unsupportedByEngine: 'tidak didukung oleh mesin terpilih', origLabel: 'Asli:', noTranslation: '(tidak ada terjemahan)', vocabTitle: 'Kosakata', vocabReload: 'Muat ulang', filterAll: 'Semua', filterWord: 'Kata', filterSentence: 'Kalimat', vocabEmpty: 'Belum ada riwayat terjemahan', vocabCopy: 'Salin', vocabCopied: 'Disalin!', pageNeedReadingView: 'Beralihlah ke Tampilan Baca untuk menerjemahkan halaman.', pageNoText: 'Tidak ada teks untuk diterjemahkan.', pageTranslating: (cur, tot) => `Menerjemahkan… ${cur}/${tot}`, pageCancel: 'Batal', pageDisabled: 'Terjemahan halaman dinonaktifkan.', ribbonVocab: 'Buka daftar kosakata', ribbonPage: 'Terjemahkan halaman / Pulihkan', settingsTitle: 'Penerjemah Tooltip Mouse', secFeatures: 'Fitur', secDesktop: 'Desktop', secMobile: 'Seluler', secTranslation: 'Terjemahan', secEngines: 'Pengaturan Mesin', secPerFeature: '🎯Pengaturan per fitur', secHoverSelection: 'Arahkan mouse / Pilih teks', secPage: 'Terjemahan Halaman', secTooltip: 'Isi Tooltip', masterEnabled: 'Aktif', masterEnabledDesc: 'Sakelar utama penerjemah.', masterRestrict: 'Batasi ke isi catatan', masterRestrictDesc: 'Hanya bekerja di dalam isi catatan.', featHover: 'Terjemahan saat diarahkan', featHoverDesc: 'Tampilkan terjemahan saat mouse diarahkan ke teks.', featSelection: 'Terjemahan teks pilihan', featSelectionDesc: 'Tampilkan terjemahan saat teks dipilih.', featPage: 'Terjemahan halaman', featPageDesc: 'Aktifkan terjemahan satu halaman penuh.', translateFrom: 'Terjemahkan dari', translateTo: 'Terjemahkan ke', languageCatalogStatus: 'Status katalog bahasa', languagePickerEngine: 'Mesin pemilih bahasa', languagePickerEngineDesc: 'Pilih mesin yang mengatur daftar bahasa sumber/tujuan.', skipSame: 'Lewati bahasa yang sama', skipSameDesc: 'Sembunyikan tooltip jika bahasa sumber dan tujuan sama.', skipIdentical: 'Lewati terjemahan identik', engineHover: 'Mesin terjemahan arahkan', engineSelection: 'Mesin terjemahan teks', enginePage: 'Mesin terjemahan halaman', llmOllama: 'Pengaturan Ollama', llmApiUrl: 'URL API', llmApiUrlDescOllama: 'URL dasar Ollama (bawaan: http://localhost:11434)', llmApiKey: 'Kunci API', llmModel: 'Model', llmModelDescOllama: 'misalnya llama3, mistral, gemma3', llmTemp: 'Temperatur', llmTempDesc: 'Keacakan pembuatan. 0 = tetap, 2 = maksimum. Bawaan: 0.0', llmPrompt: 'Templat prompt', llmPromptDesc: 'Kosongkan untuk memakai prompt bawaan. {{text}} adalah teks sumber, {{targetLang}} adalah bahasa tujuan.', activeMode: 'Mode aktif', modeBoth: 'Edit + Baca', modeEdit: 'Hanya edit', modeReading: 'Hanya baca', mouseUnit: 'Unit arahkan', hoverDelay: 'Jeda arahkan (ms)', pageHoverOrig: 'Tampilkan paragraf asli saat diarahkan selama terjemahan halaman', pageHoverOrigDesc: 'Saat menerjemahkan halaman, tampilkan teks paragraf asli sebagai pengganti terjemahan arahkan biasa.', pageTranslateYaml: 'Terjemahkan nilai properti YAML saat menyimpan', pageTranslateYamlDesc: 'Terjemahkan nilai YAML yang dapat dibaca saat menerjemahkan dan menyimpan catatan; nilai yang dapat dibaca mesin tetap sama.', pageTranslatingYaml: 'Menerjemahkan nilai properti YAML…', unitWord: 'Kata', unitSentence: 'Kalimat', showDict: 'Tampilkan kamus (kelas kata)', showTranslit: 'Tampilkan transliterasi', showSource: 'Tampilkan teks sumber', showDetected: 'Tampilkan bahasa terdeteksi', uiLang: 'Bahasa antarmuka', uiLangDesc: 'Bahasa yang digunakan di antarmuka plugin.', uiLangSystem: 'Ikuti sistem', ribbonTrans: 'Buka panel terjemahan', transPanelTitle: 'Terjemahan', transPanelPlaceholder: 'Masukkan teks untuk diterjemahkan…', transPanelSwap: 'Tukar bahasa', transPanelClear: 'Hapus', transPanelCopy: 'Salin', transPanelCopied: 'Disalin!' });
STRINGS.th = makeSoutheastAsianLocale({ autoDetect: 'ตรวจหาภาษาอัตโนมัติ', unsupportedByEngine: 'เอนจินที่เลือกไม่รองรับ', origLabel: 'ต้นฉบับ:', noTranslation: '(ไม่มีคำแปล)', vocabTitle: 'คำศัพท์', vocabReload: 'โหลดใหม่', filterAll: 'ทั้งหมด', filterWord: 'คำ', filterSentence: 'ประโยค', vocabEmpty: 'ไม่มีประวัติการแปล', vocabCopy: 'คัดลอก', vocabCopied: 'คัดลอกแล้ว!', pageNeedReadingView: 'โปรดเปลี่ยนเป็นมุมมองการอ่านเพื่อแปลหน้า', pageNoText: 'ไม่พบข้อความที่จะแปล', pageTranslating: (cur, tot) => `กำลังแปล… ${cur}/${tot}`, pageCancel: 'ยกเลิก', pageDisabled: 'ปิดใช้งานการแปลหน้าแล้ว', ribbonVocab: 'เปิดรายการคำศัพท์', ribbonPage: 'แปลหน้า / คืนค่า', settingsTitle: 'ตัวแปลคำแนะนำเมาส์', secFeatures: 'คุณสมบัติ', secDesktop: 'เดสก์ท็อป', secMobile: 'มือถือ', secTranslation: 'การแปล', secEngines: 'การตั้งค่าเอนจิน', secPerFeature: '🎯การตั้งค่าแต่ละคุณสมบัติ', secHoverSelection: 'วางเมาส์ / เลือกข้อความ', secPage: 'การแปลหน้า', secTooltip: 'เนื้อหาคำแนะนำ', masterEnabled: 'เปิดใช้งาน', masterEnabledDesc: 'สวิตช์หลักของตัวแปล', masterRestrict: 'จำกัดเฉพาะเนื้อหาโน้ต', masterRestrictDesc: 'ทำงานเฉพาะภายในเนื้อหาโน้ต', featHover: 'แปลเมื่อวางเมาส์', featHoverDesc: 'แสดงคำแปลเมื่อวางเมาส์เหนือข้อความ', featSelection: 'แปลข้อความที่เลือก', featSelectionDesc: 'แสดงคำแปลเมื่อเลือกข้อความ', featPage: 'แปลหน้า', featPageDesc: 'เปิดใช้งานการแปลทั้งหน้า', translateFrom: 'แปลจาก', translateTo: 'แปลเป็น', languageCatalogStatus: 'สถานะแคตตาล็อกภาษา', languagePickerEngine: 'เอนจินตัวเลือกภาษา', languagePickerEngineDesc: 'เลือกเอนจินที่ควบคุมรายการภาษาต้นทาง/เป้าหมาย', skipSame: 'ข้ามภาษาเดียวกัน', skipSameDesc: 'ซ่อนคำแนะนำเมื่อภาษาต้นทางและเป้าหมายเหมือนกัน', skipIdentical: 'ข้ามคำแปลที่เหมือนกัน', engineHover: 'เอนจินแปลเมื่อวางเมาส์', engineSelection: 'เอนจินแปลข้อความ', enginePage: 'เอนจินแปลหน้า', llmOllama: 'การตั้งค่า Ollama', llmApiUrl: 'URL ของ API', llmApiUrlDescOllama: 'URL พื้นฐานของ Ollama (ค่าเริ่มต้น: http://localhost:11434)', llmApiKey: 'คีย์ API', llmModel: 'โมเดล', llmModelDescOllama: 'เช่น llama3, mistral, gemma3', llmTemp: 'อุณหภูมิ', llmTempDesc: 'ระดับความสุ่ม 0 = คงที่, 2 = สูงสุด ค่าเริ่มต้น: 0.0', llmPrompt: 'แม่แบบพรอมต์', llmPromptDesc: 'เว้นว่างเพื่อใช้พรอมต์เริ่มต้น {{text}} คือข้อความต้นฉบับ และ {{targetLang}} คือภาษาเป้าหมาย', activeMode: 'โหมดที่ใช้งาน', modeBoth: 'แก้ไข + อ่าน', modeEdit: 'แก้ไขเท่านั้น', modeReading: 'อ่านเท่านั้น', mouseUnit: 'หน่วยการวางเมาส์', hoverDelay: 'เวลาหน่วง (มิลลิวินาที)', pageHoverOrig: 'แสดงย่อหน้าต้นฉบับเมื่อวางเมาส์ระหว่างการแปลหน้า', pageHoverOrigDesc: 'ระหว่างการแปลหน้า ให้แสดงข้อความต้นฉบับของย่อหน้าแทนการแปลแบบวางเมาส์ปกติ', pageTranslateYaml: 'แปลค่าคุณสมบัติ YAML เมื่อบันทึก', pageTranslateYamlDesc: 'แปลค่า YAML ที่อ่านได้เมื่อแปลและบันทึกโน้ต โดยคงค่าที่เครื่องอ่านได้ไว้', pageTranslatingYaml: 'กำลังแปลค่าคุณสมบัติ YAML…', unitWord: 'คำ', unitSentence: 'ประโยค', showDict: 'แสดงพจนานุกรม (ชนิดคำ)', showTranslit: 'แสดงการถอดเสียง', showSource: 'แสดงข้อความต้นฉบับ', showDetected: 'แสดงภาษาที่ตรวจพบ', uiLang: 'ภาษาของอินเทอร์เฟซ', uiLangDesc: 'ภาษาที่ใช้ในอินเทอร์เฟซปลั๊กอิน', uiLangSystem: 'ตามระบบ', ribbonTrans: 'เปิดแผงแปล', transPanelTitle: 'การแปล', transPanelPlaceholder: 'ป้อนข้อความที่จะแปล…', transPanelSwap: 'สลับภาษา', transPanelClear: 'ล้าง', transPanelCopy: 'คัดลอก', transPanelCopied: 'คัดลอกแล้ว!' });

// Localize the provider-profiled OpenAI Compatible API in every supported UI locale.
const LLM_PROFILE_LOCALIZATIONS = {
  ja: ['プロバイダープリセット', 'ホスト型またはローカルのOpenAI互換プロバイダーを選ぶか、カスタムエンドポイントを設定します。', 'APIバージョンを含むOpenAI互換ベースURL（例：http://localhost:11434/v1）。', 'モデル名を入力するか、エンドポイントから利用可能なモデルを取得します。', '利用可能なモデルを取得', '先にAPI URLを設定してください。', 'このエンドポイントからモデルが返されませんでした。', 'LLMモデルを取得できませんでした：', '件のモデルを取得しました。モデル欄から選択できます。'],
  'zh-TW': ['供應商預設', '選擇雲端或本機 OpenAI 相容供應商預設，或設定自訂端點。', '包含 API 版本的 OpenAI 相容基礎網址（例如：http://localhost:11434/v1）。', '輸入模型名稱，或從端點取得可用模型。', '取得可用模型', '請先設定 API 網址。', '此端點未傳回任何模型。', '無法取得 LLM 模型：', ' 個模型，請在模型欄位中選擇。'],
  'zh-CN': ['提供商预设', '选择云端或本地 OpenAI 兼容提供商预设，或配置自定义端点。', '包含 API 版本的 OpenAI 兼容基础网址（例如：http://localhost:11434/v1）。', '输入模型名称，或从端点获取可用模型。', '获取可用模型', '请先设置 API 网址。', '此端点未返回任何模型。', '无法获取 LLM 模型：', ' 个模型，请在模型字段中选择。'],
  ko: ['공급자 사전 설정', '호스팅 또는 로컬 OpenAI 호환 공급자 사전 설정을 선택하거나 사용자 지정 엔드포인트를 구성합니다.', 'API 버전을 포함한 OpenAI 호환 기본 URL(예: http://localhost:11434/v1).', '모델 이름을 입력하거나 엔드포인트에서 사용 가능한 모델을 가져옵니다.', '사용 가능한 모델 가져오기', '먼저 API URL을 설정하세요.', '이 엔드포인트에서 반환한 모델이 없습니다.', 'LLM 모델을 가져올 수 없습니다: ', '개의 모델을 가져왔습니다. 모델 필드에서 선택하세요.'],
  fr: ['Préréglage du fournisseur', 'Choisissez un fournisseur compatible OpenAI hébergé ou local, ou configurez un point de terminaison personnalisé.', 'URL de base compatible OpenAI avec la version de l’API (par exemple : http://localhost:11434/v1).', 'Saisissez un nom de modèle ou récupérez les modèles disponibles depuis le point de terminaison.', 'Récupérer les modèles disponibles', 'Définissez d’abord une URL d’API.', 'Ce point de terminaison n’a renvoyé aucun modèle.', 'Impossible de récupérer les modèles LLM : ', ' modèles récupérés. Sélectionnez-en un dans le champ Modèle.'],
  es: ['Preajuste del proveedor', 'Elige un proveedor compatible con OpenAI alojado o local, o configura un punto de conexión personalizado.', 'URL base compatible con OpenAI que incluye la versión de la API (por ejemplo, http://localhost:11434/v1).', 'Introduce un nombre de modelo u obtén los modelos disponibles desde el punto de conexión.', 'Obtener modelos disponibles', 'Primero configura una URL de API.', 'Este punto de conexión no devolvió modelos.', 'No se pudieron obtener los modelos LLM: ', ' modelos obtenidos. Selecciona uno en el campo de modelo.'],
  de: ['Anbietervoreinstellung', 'Wähle eine gehostete oder lokale OpenAI-kompatible Anbietervoreinstellung oder konfiguriere einen benutzerdefinierten Endpunkt.', 'OpenAI-kompatible Basis-URL einschließlich API-Version (z. B. http://localhost:11434/v1).', 'Gib einen Modellnamen ein oder rufe die vom Endpunkt verfügbaren Modelle ab.', 'Verfügbare Modelle abrufen', 'Lege zuerst eine API-URL fest.', 'Dieser Endpunkt hat keine Modelle zurückgegeben.', 'LLM-Modelle konnten nicht abgerufen werden: ', ' Modelle abgerufen. Wähle eines im Modellfeld aus.'],
  nl: ['Provider-voorinstelling', 'Kies een gehoste of lokale OpenAI-compatibele provider-voorinstelling, of stel een aangepast endpoint in.', 'OpenAI-compatibele basis-URL met API-versie (bijvoorbeeld: http://localhost:11434/v1).', 'Voer een modelnaam in of haal de beschikbare modellen op bij het endpoint.', 'Beschikbare modellen ophalen', 'Stel eerst een API-URL in.', 'Dit endpoint heeft geen modellen teruggegeven.', 'LLM-modellen konden niet worden opgehaald: ', ' modellen opgehaald. Kies er een in het modelveld.'],
  sv: ['Leverantörsförval', 'Välj en värdbaserad eller lokal OpenAI-kompatibel leverantörsförinställning, eller konfigurera en egen slutpunkt.', 'OpenAI-kompatibel bas-URL med API-version (t.ex. http://localhost:11434/v1).', 'Ange ett modellnamn eller hämta modellerna som slutpunkten erbjuder.', 'Hämta tillgängliga modeller', 'Ange först en API-URL.', 'Den här slutpunkten returnerade inga modeller.', 'Det gick inte att hämta LLM-modeller: ', ' modeller hämtades. Välj en i modellfältet.'],
  vi: ['Cấu hình sẵn nhà cung cấp', 'Chọn cấu hình sẵn nhà cung cấp tương thích OpenAI trên đám mây hoặc cục bộ, hoặc cấu hình điểm cuối tùy chỉnh.', 'URL cơ sở tương thích OpenAI bao gồm phiên bản API (ví dụ: http://localhost:11434/v1).', 'Nhập tên mô hình hoặc lấy các mô hình có sẵn từ điểm cuối.', 'Lấy các mô hình có sẵn', 'Hãy đặt URL API trước.', 'Điểm cuối này không trả về mô hình nào.', 'Không thể lấy mô hình LLM: ', ' mô hình đã được lấy. Hãy chọn một mô hình trong trường Mô hình.'],
  id: ['Preset penyedia', 'Pilih preset penyedia kompatibel OpenAI yang dihosting atau lokal, atau atur endpoint khusus.', 'URL dasar kompatibel OpenAI termasuk versi API (misalnya: http://localhost:11434/v1).', 'Masukkan nama model atau ambil model yang tersedia dari endpoint.', 'Ambil model yang tersedia', 'Atur URL API terlebih dahulu.', 'Endpoint ini tidak mengembalikan model.', 'Tidak dapat mengambil model LLM: ', ' model berhasil diambil. Pilih salah satu di kolom model.'],
  th: ['ค่าที่ตั้งไว้ล่วงหน้าของผู้ให้บริการ', 'เลือกค่าที่ตั้งไว้ล่วงหน้าของผู้ให้บริการที่เข้ากันได้กับ OpenAI แบบโฮสต์หรือในเครื่อง หรือกำหนดปลายทางแบบกำหนดเอง', 'URL ฐานที่เข้ากันได้กับ OpenAI ซึ่งรวมเวอร์ชัน API (เช่น http://localhost:11434/v1)', 'ป้อนชื่อโมเดลหรือดึงโมเดลที่มีจากปลายทาง', 'ดึงโมเดลที่มี', 'โปรดตั้งค่า URL ของ API ก่อน', 'ปลายทางนี้ไม่ส่งคืนโมเดลใด ๆ', 'ไม่สามารถดึงโมเดล LLM ได้: ', ' โมเดลถูกดึงแล้ว เลือกได้ในช่องโมเดล'],
};
for (const [locale, values] of Object.entries(LLM_PROFILE_LOCALIZATIONS)) {
  const [provider, providerDesc, apiDesc, modelDesc, fetchModels, noEndpoint, noModels, failedPrefix, okSuffix] = values;
  Object.assign(STRINGS[locale], {
    llmProvider: provider, llmProviderDesc: providerDesc, llmApiUrlDescLegacy: apiDesc, llmModelDescLegacy: modelDesc,
    llmFetchModels: fetchModels, llmFetchNoEndpoint: noEndpoint, llmFetchNoModels: noModels,
    llmFetchFailed: (message) => `${failedPrefix}${message}`, llmFetchOk: (count) => `${count}${okSuffix}`,
  });
}

const FALLBACK_LOCALIZATIONS = {
  ja: ['自動フォールバックエンジン', '対応するWeb翻訳エンジンが失敗した場合、Google、Bing、Baiduで再試行し、失敗したエンジンを一時的に休止します。'],
  'zh-TW': ['自動備援翻譯引擎', '支援的網頁翻譯引擎失敗時，使用 Google、Bing 或 Baidu 重試，並暫時停用失敗的引擎。'],
  'zh-CN': ['自动备用翻译引擎', '受支持的网页翻译引擎失败时，使用 Google、Bing 或 Baidu 重试，并暂时停用失败的引擎。'],
  ko: ['자동 대체 번역 엔진', '지원되는 웹 번역 엔진이 실패하면 Google, Bing 또는 Baidu로 다시 시도하고 실패한 엔진을 일시적으로 중지합니다.'],
  fr: ['Moteur de secours automatique', 'Lorsqu’un moteur de traduction web pris en charge échoue, réessayez avec Google, Bing ou Baidu et désactivez temporairement le moteur défaillant.'],
  es: ['Motor de respaldo automático', 'Cuando falle un motor de traducción web compatible, vuelve a intentarlo con Google, Bing o Baidu y desactiva temporalmente el motor que falló.'],
  de: ['Automatische Fallback-Engine', 'Wenn eine unterstützte Web-Übersetzungsengine fehlschlägt, wird es mit Google, Bing oder Baidu erneut versucht und die fehlgeschlagene Engine vorübergehend deaktiviert.'],
  nl: ['Automatische terugvalengine', 'Wanneer een ondersteunde webvertaalengine faalt, probeer opnieuw met Google, Bing of Baidu en zet de mislukte engine tijdelijk uit.'],
  sv: ['Automatisk reservmotor', 'När en webbaserad översättningsmotor som stöds misslyckas försöker den igen med Google, Bing eller Baidu och stänger tillfälligt av den felande motorn.'],
  vi: ['Bộ máy dự phòng tự động', 'Khi bộ máy dịch web được hỗ trợ gặp lỗi, hãy thử lại bằng Google, Bing hoặc Baidu và tạm thời ngưng bộ máy bị lỗi.'],
  id: ['Mesin cadangan otomatis', 'Saat mesin terjemahan web yang didukung gagal, coba lagi dengan Google, Bing, atau Baidu dan nonaktifkan sementara mesin yang gagal.'],
  th: ['เอนจินสำรองอัตโนมัติ', 'เมื่อเอนจินแปลเว็บที่รองรับล้มเหลว ให้ลองใหม่ด้วย Google, Bing หรือ Baidu และพักเอนจินที่ล้มเหลวชั่วคราว'],
};
for (const [locale, [name, description]] of Object.entries(FALLBACK_LOCALIZATIONS)) {
  Object.assign(STRINGS[locale], { fallbackEngine: name, fallbackEngineDesc: description });
}

const DOCUMENTATION_LOCALIZATIONS = {
  ja: ['ドキュメント', 'GitHub でセットアップ手順と機能の説明を確認します。', 'ドキュメントを開く'],
  'zh-TW': ['說明文件', '在 GitHub 上閱讀設定步驟與功能說明。', '開啟說明文件'],
  'zh-CN': ['文档', '在 GitHub 上查看设置说明和功能文档。', '打开文档'],
  ko: ['문서', 'GitHub에서 설정 안내와 기능 문서를 확인합니다.', '문서 열기'],
  fr: ['Documentation', 'Consultez les instructions de configuration et la documentation des fonctionnalités sur GitHub.', 'Ouvrir la documentation'],
  es: ['Documentación', 'Consulta las instrucciones de configuración y la documentación de las funciones en GitHub.', 'Abrir documentación'],
  de: ['Dokumentation', 'Lies die Einrichtungsanleitung und die Funktionsdokumentation auf GitHub.', 'Dokumentation öffnen'],
  nl: ['Documentatie', 'Lees de installatie-instructies en functiedocumentatie op GitHub.', 'Documentatie openen'],
  sv: ['Dokumentation', 'Läs installationsanvisningar och funktionsdokumentation på GitHub.', 'Öppna dokumentation'],
  vi: ['Tài liệu', 'Đọc hướng dẫn thiết lập và tài liệu tính năng trên GitHub.', 'Mở tài liệu'],
  id: ['Dokumentasi', 'Baca petunjuk penyiapan dan dokumentasi fitur di GitHub.', 'Buka dokumentasi'],
  th: ['เอกสาร', 'อ่านคำแนะนำการตั้งค่าและเอกสารคุณสมบัติบน GitHub', 'เปิดเอกสาร'],
};
for (const [locale, [name, description, button]] of Object.entries(DOCUMENTATION_LOCALIZATIONS)) {
  Object.assign(STRINGS[locale], {
    documentation: name,
    documentationDesc: description,
    openDocumentation: button,
  });
}

Object.assign(STRINGS.vi, { llmOpenai: 'API tương thích OpenAI' });
Object.assign(STRINGS.id, { llmOpenai: 'API kompatibel OpenAI' });
Object.assign(STRINGS.th, { llmOpenai: 'API ที่เข้ากันได้กับ OpenAI' });

const PANEL_ENGINE_LOCALIZATIONS = {
  ja: ['翻訳エンジン', 'テキスト選択用エンジンを使用'],
  'zh-TW': ['翻譯引擎', '使用文字選取翻譯引擎'], 'zh-CN': ['翻译引擎', '使用文本选择翻译引擎'],
  ko: ['번역 엔진', '텍스트 선택 번역 엔진 사용'], fr: ['Moteur de traduction', 'Utiliser le moteur de sélection de texte'],
  es: ['Motor de traducción', 'Usar el motor de selección de texto'], de: ['Übersetzungsengine', 'Engine für Textauswahl verwenden'],
  nl: ['Vertaalengine', 'Engine voor tekstselectie gebruiken'], sv: ['Översättningsmotor', 'Använd motorn för textmarkering'],
  vi: ['Bộ máy dịch', 'Dùng bộ máy dịch văn bản đã chọn'], id: ['Mesin terjemahan', 'Gunakan mesin terjemahan pilihan teks'],
  th: ['เอนจินการแปล', 'ใช้เอนจินการแปลข้อความที่เลือก'],
};
for (const [locale, [engine, selection]] of Object.entries(PANEL_ENGINE_LOCALIZATIONS)) {
  Object.assign(STRINGS[locale], { transPanelEngine: engine, transPanelEngineSelection: selection });
}
const PAGE_ENGINE_LOCALIZATIONS = {
  ja: ['ページ翻訳エンジン', 'ページ翻訳用エンジンを使用'], 'zh-TW': ['頁面翻譯引擎', '使用頁面翻譯引擎'],
  'zh-CN': ['页面翻译引擎', '使用页面翻译引擎'], ko: ['페이지 번역 엔진', '페이지 번역 엔진 사용'],
  fr: ['Moteur de traduction de page', 'Utiliser le moteur de traduction de page'], es: ['Motor de traducción de página', 'Usar el motor de traducción de página'],
  de: ['Engine für Seitenübersetzung', 'Engine für Seitenübersetzung verwenden'], nl: ['Engine voor paginavertaling', 'Engine voor paginavertaling gebruiken'],
  sv: ['Motor för sidöversättning', 'Använd motorn för sidöversättning'], vi: ['Bộ máy dịch trang', 'Dùng bộ máy dịch trang'],
  id: ['Mesin terjemahan halaman', 'Gunakan mesin terjemahan halaman'], th: ['เอนจินการแปลหน้า', 'ใช้เอนจินการแปลหน้า'],
};
for (const [locale, [engine, defaultLabel]] of Object.entries(PAGE_ENGINE_LOCALIZATIONS)) {
  Object.assign(STRINGS[locale], { pageTranslationEngine: engine, pageTranslationEngineDefault: defaultLabel });
}

const DUAL_LANGUAGE_SAVE_LOCALIZATIONS = {
  ja: ['翻訳ページを対訳ノートとして保存', '対訳ノートを保存しました：', '対訳ノートを保存できませんでした。詳細はコンソールを確認してください。'],
  'zh-TW': ['將翻譯頁面儲存為雙語筆記', '已儲存雙語筆記：', '無法儲存雙語筆記，請查看主控台。'],
  'zh-CN': ['将翻译页面保存为双语笔记', '已保存双语笔记：', '无法保存双语笔记，请查看控制台。'],
  ko: ['번역한 페이지를 이중 언어 노트로 저장', '이중 언어 노트를 저장했습니다: ', '이중 언어 노트를 저장할 수 없습니다. 자세한 내용은 콘솔을 확인하세요.'],
  fr: ['Enregistrer la page traduite comme note bilingue', 'Note bilingue enregistrée : ', 'Impossible d’enregistrer la note bilingue. Consultez la console pour plus de détails.'],
  es: ['Guardar la página traducida como nota bilingüe', 'Nota bilingüe guardada: ', 'No se pudo guardar la nota bilingüe. Consulta la consola para obtener más detalles.'],
  de: ['Übersetzte Seite als zweisprachige Notiz speichern', 'Zweisprachige Notiz gespeichert: ', 'Die zweisprachige Notiz konnte nicht gespeichert werden. Weitere Details findest du in der Konsole.'],
  nl: ['Vertaalde pagina opslaan als tweetalige notitie', 'Tweetalige notitie opgeslagen: ', 'De tweetalige notitie kon niet worden opgeslagen. Bekijk de console voor meer informatie.'],
  sv: ['Spara översatt sida som tvåspråkig anteckning', 'Tvåspråkig anteckning sparad: ', 'Det gick inte att spara den tvåspråkiga anteckningen. Se konsolen för mer information.'],
  vi: ['Lưu trang đã dịch thành ghi chú song ngữ', 'Đã lưu ghi chú song ngữ: ', 'Không thể lưu ghi chú song ngữ. Hãy xem bảng điều khiển để biết chi tiết.'],
  id: ['Simpan halaman terjemahan sebagai catatan dwibahasa', 'Catatan dwibahasa disimpan: ', 'Tidak dapat menyimpan catatan dwibahasa. Periksa konsol untuk detailnya.'],
  th: ['บันทึกหน้าที่แปลเป็นโน้ตสองภาษา', 'บันทึกโน้ตสองภาษาแล้ว: ', 'ไม่สามารถบันทึกโน้ตสองภาษาได้ โปรดตรวจสอบคอนโซลสำหรับรายละเอียด'],
};
for (const [locale, [save, savedPrefix, failed]] of Object.entries(DUAL_LANGUAGE_SAVE_LOCALIZATIONS)) {
  Object.assign(STRINGS[locale], {
    pageSaveDualLanguage: save,
    pageDualSaved: (path) => `${savedPrefix}${path}`,
    pageDualSaveFailed: failed,
  });
}

// Returns the merged strings for the current Obsidian locale (falls back to English).
let _mttSettings = null;
function getInterfaceLocale() {
  const selected = _mttSettings?.uiLang;
  if (selected && selected !== 'system') return selected;
  const loc = (typeof window !== 'undefined' && window.moment?.locale?.()) || 'en';
  const normalized = loc.toLowerCase().replace('_', '-');
  return /^ja/.test(normalized) ? 'ja'
    : /^ko/.test(normalized) ? 'ko'
      : /^de/.test(normalized) ? 'de'
        : /^nl/.test(normalized) ? 'nl'
          : /^sv/.test(normalized) ? 'sv'
            : /^fr/.test(normalized) ? 'fr'
              : /^es/.test(normalized) ? 'es'
                : /^zh-(tw|hk|mo|hant)/.test(normalized) ? 'zh-TW'
                  : /^zh/.test(normalized) ? 'zh-CN'
                    : /^vi/.test(normalized) ? 'vi'
                      : /^id/.test(normalized) ? 'id'
                        : /^th/.test(normalized) ? 'th'
                          : 'en';
}

function i18n() {
  const lang = getInterfaceLocale();
  return lang === 'en' ? STRINGS.en : { ...STRINGS.en, ...STRINGS[lang] };
}

const COMMAND_LABELS = {
  en: { openPanel: 'Open translation panel', openVocab: 'Open vocabulary list', openGlossary: 'Open glossary', hideTooltip: 'Hide tooltip', toggle: 'Toggle translator on/off', translateSelection: 'Translate current selection', translatePage: 'Translate current page', restorePage: 'Restore original text (page translation)', copyTranslation: 'Copy translation to clipboard', reloadGlossary: 'Reload glossary' },
  ja: { openPanel: '翻訳パネルを開く', openVocab: '単語帳を開く', hideTooltip: 'ツールチップを隠す', toggle: '翻訳機能をオン / オフ', translateSelection: '現在の選択範囲を翻訳', translatePage: '現在のページを翻訳', restorePage: '原文に戻す（ページ翻訳）', copyTranslation: '翻訳をクリップボードにコピー' },
  'zh-TW': { openPanel: '開啟翻譯面板', openVocab: '開啟單字庫', hideTooltip: '隱藏提示框', toggle: '切換翻譯器開關', translateSelection: '翻譯目前選取的文字', translatePage: '翻譯目前頁面', restorePage: '還原原文（頁面翻譯）', copyTranslation: '將翻譯複製到剪貼簿' },
  'zh-CN': { openPanel: '打开翻译面板', openVocab: '打开词汇表', hideTooltip: '隐藏提示框', toggle: '切换翻译器开关', translateSelection: '翻译当前选中的文本', translatePage: '翻译当前页面', restorePage: '还原原文（页面翻译）', copyTranslation: '将翻译复制到剪贴板' },
  id: { openPanel: 'Buka panel terjemahan', openVocab: 'Buka daftar kosakata', hideTooltip: 'Sembunyikan tooltip', toggle: 'Aktifkan/nonaktifkan penerjemah', translateSelection: 'Terjemahkan pilihan saat ini', translatePage: 'Terjemahkan halaman saat ini', restorePage: 'Pulihkan teks asli (terjemahan halaman)', copyTranslation: 'Salin terjemahan ke papan klip' },
  vi: { openPanel: 'Mở bảng dịch', openVocab: 'Mở danh sách từ vựng', hideTooltip: 'Ẩn chú giải', toggle: 'Bật/tắt trình dịch', translateSelection: 'Dịch phần văn bản đã chọn', translatePage: 'Dịch trang hiện tại', restorePage: 'Khôi phục văn bản gốc (dịch trang)', copyTranslation: 'Sao chép bản dịch vào bộ nhớ tạm' },
  th: { openPanel: 'เปิดแผงแปล', openVocab: 'เปิดรายการคำศัพท์', hideTooltip: 'ซ่อนคำแนะนำ', toggle: 'สลับเปิด/ปิดตัวแปล', translateSelection: 'แปลข้อความที่เลือก', translatePage: 'แปลหน้าปัจจุบัน', restorePage: 'คืนค่าข้อความต้นฉบับ (การแปลหน้า)', copyTranslation: 'คัดลอกคำแปลไปยังคลิปบอร์ด' },
  fr: { openPanel: 'Ouvrir le panneau de traduction', openVocab: 'Ouvrir la liste de vocabulaire', hideTooltip: 'Masquer l’infobulle', toggle: 'Activer/désactiver le traducteur', translateSelection: 'Traduire la sélection actuelle', translatePage: 'Traduire la page actuelle', restorePage: 'Restaurer le texte original (traduction de page)', copyTranslation: 'Copier la traduction dans le presse-papiers' },
  es: { openPanel: 'Abrir panel de traducción', openVocab: 'Abrir lista de vocabulario', hideTooltip: 'Ocultar información emergente', toggle: 'Activar/desactivar traductor', translateSelection: 'Traducir la selección actual', translatePage: 'Traducir página actual', restorePage: 'Restaurar texto original (traducción de página)', copyTranslation: 'Copiar traducción al portapapeles' },
  ko: { openPanel: '번역 패널 열기', openVocab: '단어장 열기', hideTooltip: '툴팁 숨기기', toggle: '번역기 켜기/끄기', translateSelection: '현재 선택 영역 번역', translatePage: '현재 페이지 번역', restorePage: '원문 복원 (페이지 번역)', copyTranslation: '번역을 클립보드에 복사' },
  de: { openPanel: 'Übersetzungsbereich öffnen', openVocab: 'Vokabelliste öffnen', hideTooltip: 'Tooltip ausblenden', toggle: 'Übersetzer ein-/ausschalten', translateSelection: 'Aktuelle Auswahl übersetzen', translatePage: 'Aktuelle Seite übersetzen', restorePage: 'Originaltext wiederherstellen (Seitenübersetzung)', copyTranslation: 'Übersetzung in die Zwischenablage kopieren' },
  nl: { openPanel: 'Vertaalpaneel openen', openVocab: 'Woordenlijst openen', hideTooltip: 'Tooltip verbergen', toggle: 'Vertaler in-/uitschakelen', translateSelection: 'Huidige selectie vertalen', translatePage: 'Huidige pagina vertalen', restorePage: 'Oorspronkelijke tekst herstellen (paginavertaling)', copyTranslation: 'Vertaling naar het klembord kopiëren' },
  sv: { openPanel: 'Öppna översättningspanel', openVocab: 'Öppna ordlista', hideTooltip: 'Dölj verktygstips', toggle: 'Slå på/av översättaren', translateSelection: 'Översätt aktuell markering', translatePage: 'Översätt aktuell sida', restorePage: 'Återställ originaltext (sidöversättning)', copyTranslation: 'Kopiera översättning till urklipp' },
};

function commandLabel(key) {
  return COMMAND_LABELS[getInterfaceLocale()]?.[key] || COMMAND_LABELS.en[key] || i18n()[key] || key;
}

// Selector for nodes that count as "note content".
// .cm-content       : CodeMirror 6 editor content (source / live preview)
// .markdown-preview-view : reading mode container
// .markdown-rendered     : rendered markdown anywhere (embeds, hover preview, etc.)
const NOTE_CONTENT_SELECTOR = '.cm-content, .markdown-preview-view, .markdown-rendered';

function isInNoteContent(node, selector) {
  if (!node) return false;
  const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (!el) return false;
  return !!el.closest(selector || NOTE_CONTENT_SELECTOR);
}

// Extracts the pre-translation text stored in data-mtt-orig (which is raw innerHTML).
function getOriginalText(el) {
  const orig = el.getAttribute('data-mtt-orig');
  if (!orig) return null;
  const tmp = document.createElement('div');
  tmp.innerHTML = orig;
  return tmp.textContent.trim() || null;
}

// A "no-op translation" is one we don't want to display. Each check is gated
// by its own user setting so the behavior can be tuned:
//   - skipSameLanguage : detected source language equals target language.
//   - skipIdenticalText: translated text is identical to the source text
//                        (catches mis-detected language codes for proper nouns,
//                         codes, single tokens that the API echoed back, etc.).
function isNoopTranslation(result, text, opts) {
  if (!result || !result.targetText) return false;
  const { skipSameLanguage = true, skipIdenticalText = false } = opts || {};
  if (skipSameLanguage
      && result.sourceLang && result.targetLang
      && result.sourceLang === result.targetLang) return true;
  if (skipIdenticalText && result.targetText.trim() === (text || '').trim()) return true;
  return false;
}

// Canonical, vendor-neutral language registry. These BCP-47 / ISO codes are
// persisted in settings and translation history. Engine adapters translate
// them into vendor codes only at request time.
const CANONICAL_LANGUAGES = {
  auto: 'Auto detect',
  af: 'Afrikaans', sq: 'Albanian', am: 'Amharic', ar: 'Arabic', hy: 'Armenian',
  az: 'Azerbaijani', eu: 'Basque', be: 'Belarusian', bn: 'Bengali', bs: 'Bosnian',
  bg: 'Bulgarian', my: 'Burmese', ca: 'Catalan', ceb: 'Cebuano', zh: 'Chinese',
  'zh-CN': 'Chinese (Simplified)', 'zh-TW': 'Chinese (Traditional)',
  hr: 'Croatian', cs: 'Czech', da: 'Danish', nl: 'Dutch', en: 'English',
  eo: 'Esperanto', et: 'Estonian', fa: 'Persian', fil: 'Filipino', fi: 'Finnish',
  fr: 'French', gl: 'Galician', ka: 'Georgian', de: 'German', el: 'Greek',
  gu: 'Gujarati', ht: 'Haitian Creole', he: 'Hebrew', hi: 'Hindi', hu: 'Hungarian',
  is: 'Icelandic', id: 'Indonesian', ga: 'Irish', it: 'Italian', ja: 'Japanese',
  jv: 'Javanese', kn: 'Kannada', kk: 'Kazakh', km: 'Khmer', ko: 'Korean',
  ky: 'Kyrgyz', lo: 'Lao', la: 'Latin', lv: 'Latvian', lt: 'Lithuanian',
  lb: 'Luxembourgish', mk: 'Macedonian', mg: 'Malagasy', ms: 'Malay',
  ml: 'Malayalam', mt: 'Maltese', mi: 'Maori', mr: 'Marathi', mn: 'Mongolian',
  ne: 'Nepali', no: 'Norwegian', pl: 'Polish', pt: 'Portuguese',
  'pt-BR': 'Portuguese (Brazil)', 'pt-PT': 'Portuguese (Portugal)', pa: 'Punjabi',
  ro: 'Romanian', ru: 'Russian', gd: 'Scottish Gaelic', sr: 'Serbian',
  si: 'Sinhala', sk: 'Slovak', sl: 'Slovenian', es: 'Spanish', su: 'Sundanese',
  sw: 'Swahili', sv: 'Swedish', tl: 'Tagalog', tg: 'Tajik', ta: 'Tamil',
  tt: 'Tatar', te: 'Telugu', th: 'Thai', tr: 'Turkish', uk: 'Ukrainian',
  ur: 'Urdu', uz: 'Uzbek', vi: 'Vietnamese', cy: 'Welsh', xh: 'Xhosa',
  yi: 'Yiddish', zu: 'Zulu',
};

// Kept as an alias because prompt building and older UI code use this name.
const COMMON_LANGS = CANONICAL_LANGUAGES;

const LANGUAGE_CODE_ALIASES = { iw: 'he', jw: 'jv' };

function canonicalLanguageCode(code) {
  return LANGUAGE_CODE_ALIASES[code] || code;
}

function languageName(code) {
  const canonical = canonicalLanguageCode(code);
  if (canonical === 'auto') return i18n().autoDetect || CANONICAL_LANGUAGES.auto;
  const fallback = CANONICAL_LANGUAGES[canonical] || code;
  if (typeof Intl === 'undefined' || typeof Intl.DisplayNames !== 'function') return fallback;
  try {
    return new Intl.DisplayNames([getInterfaceLocale()], { type: 'language' }).of(canonical) || fallback;
  } catch (_) {
    return fallback;
  }
}

function languageOptionLabel(code) {
  return `${languageName(code)} (${code})`;
}

function unsupportedLanguageOption(code) {
  return `${languageOptionLabel(code)} — ${i18n().unsupportedByEngine || 'unsupported by selected engine'}`;
}

/*
 * A catalog adapter never changes a saved setting. It only tells the UI and
 * request layer which canonical codes an engine accepts. Official API adapters
 * can later replace a bundled catalog with a live resolver and cache its
 * normalized result without changing settings or translation history.
 */
const ALL_CANONICAL_SOURCE_CODES = Object.keys(CANONICAL_LANGUAGES);
const ALL_CANONICAL_TARGET_CODES = ALL_CANONICAL_SOURCE_CODES.filter((code) => code !== 'auto');

// ---- HTTP helpers wrapping Obsidian's requestUrl (bypasses CORS) ----
function buildUrl(base, searchParams) {
  if (!searchParams) return base;
  const u = new URL(base);
  for (const [k, v] of Object.entries(searchParams)) {
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  }
  return u.toString();
}

async function http(method, url, { headers, body, searchParams } = {}) {
  const finalUrl = buildUrl(url, searchParams);
  let bodyStr;
  if (body instanceof URLSearchParams) bodyStr = body.toString();
  else if (body !== undefined && typeof body !== 'string') bodyStr = JSON.stringify(body);
  else bodyStr = body;
  const res = await requestUrl({
    url: finalUrl,
    method,
    headers: headers || undefined,
    body: bodyStr,
    throw: false,
  });
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
  return res;
}
async function httpGetText(url, opts) { return (await http('GET', url, opts)).text; }
// Extract "name=value" cookie pairs from a Set-Cookie response header.
// Obsidian's requestUrl may expose it as an array (one entry per cookie) or as a
// single comma-joined string; handle both, avoiding the comma inside Expires=...GMT.
function parseSetCookie(setCookie) {
  if (!setCookie) return '';
  const list = Array.isArray(setCookie)
    ? setCookie
    : String(setCookie).split(/,(?=\s*[A-Za-z0-9!#$%&'*+\-.^_`|~]+=)/);
  return list.map((c) => c.split(';')[0].trim()).filter(Boolean).join('; ');
}
async function httpJson(method, url, opts) {
  const res = await http(method, url, opts);
  if (res.json !== undefined && res.json !== null) return res.json;
  return JSON.parse(res.text);
}

// Local detection is needed by the Google Web and image-search integrations.
let _langDetector = null;
async function detectLangLocal(text) {
  try {
    if (typeof LanguageDetector !== 'undefined') {
      if (!_langDetector) _langDetector = await LanguageDetector.create();
      const results = await _langDetector.detect(text);
      const lang = results?.[0]?.detectedLanguage;
      if (lang) return canonicalLanguageCode(lang === 'zh' ? 'zh-CN' : lang);
    }
  } catch { /* fall through to script heuristics */ }
  if (/[\u3040-\u30ff]/.test(text)) return 'ja';
  if (/[\uac00-\ud7af]/.test(text)) return 'ko';
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh-CN';
  if (/[\u0400-\u052f]/.test(text)) return 'ru';
  if (/[\u0600-\u06ff]/.test(text)) return 'ar';
  if (/[\u0e00-\u0e7f]/.test(text)) return 'th';
  if (/[\u0590-\u05ff]/.test(text)) return 'he';
  if (/[\u0370-\u03ff]/.test(text)) return 'el';
  if (/[\u0900-\u097f]/.test(text)) return 'hi';
  return 'en';
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function getBase64(url) {
  const res = await http('GET', url);
  const type = (res.headers && (res.headers['content-type'] || res.headers['Content-Type'])) || 'image/jpeg';
  return `data:${type};base64,${arrayBufferToBase64(res.arrayBuffer)}`;
}

// ---- Base translator (mirrors module 2760 of Chrome ext) ----
class BaseTranslator {
  static langCodeJson = {};
  static encodeLang(c) {
    return Object.prototype.hasOwnProperty.call(this.langCodeJson, c) ? this.langCodeJson[c] : c;
  }
  static decodeLang(c) {
    if (!this._swap) {
      this._swap = Object.fromEntries(
        Object.entries(this.langCodeJson).map(([k, v]) => [v, k])
      );
    }
    return Object.prototype.hasOwnProperty.call(this._swap, c) ? this._swap[c] : c;
  }
  static async translate(text, src, tgt, settings) {
    try {
      const esrc = this.encodeLang(src || 'auto');
      const etgt = this.encodeLang(tgt);
      const raw = await this.requestTranslate(text, esrc, etgt, settings);
      const wrapped = await this.wrapResponse(raw, text, esrc, etgt);
      if (!wrapped || wrapped.targetText == null) return null;
      return {
        targetText: wrapped.targetText,
        sourceLang: this.decodeLang(wrapped.detectedLang || esrc),
        targetLang: this.decodeLang(etgt),
        transliteration: wrapped.transliteration || '',
        dict: Array.isArray(wrapped.dict) && wrapped.dict.length ? wrapped.dict : null,
      };
    } catch (e) {
      console.warn('[mtt]', this.name || 'translator', 'failed:', e);
      return null;
    }
  }
  static async requestTranslate() { throw new Error('not implemented'); }
  static async wrapResponse() { throw new Error('not implemented'); }
}

// ---- Google (translate_a/single) ----
// dj=1: JSON object form.  dt=bd: bilingual dictionary (POS).  dt=rm: transliteration.
class GoogleEngine extends BaseTranslator {
  static langCodeJson = { auto: 'auto' };
  static async requestTranslate(text, src, tgt) {
    const params = new URLSearchParams({
      client: 'gtx',
      sl: src || 'auto',
      tl: tgt,
      dj: '1',
      hl: tgt,
      q: text,
    });
    params.append('dt', 't');
    params.append('dt', 'bd');
    params.append('dt', 'rm');
    return await httpJson('GET', `https://translate.googleapis.com/translate_a/single?${params.toString()}`);
  }
  static async wrapResponse(data, text, src) {
    if (!data || typeof data !== 'object') return null;
    const sentences = Array.isArray(data.sentences) ? data.sentences : [];
    // Google separates sentence and newline chunks. Do not add whitespace when
    // rebuilding the response or paragraph boundaries become corrupted.
    const targetText = sentences.map((s) => (s && s.trans) || '').join('');
    const transliteration = sentences.map((s) => (s && s.src_translit) || '').join('');
    if (!targetText) return null;
    const dict = Array.isArray(data.dict)
      ? data.dict
          .filter((d) => d && Array.isArray(d.terms) && d.terms.length > 0)
          .map((d) => ({ pos: d.pos || '', terms: d.terms.slice(0, 3) }))
      : null;
    return { targetText, detectedLang: data.src || src, transliteration, dict };
  }
}

// ---- Google GTX (translate_a/t) ----
class GoogleGTXEngine extends BaseTranslator {
  static langCodeJson = { auto: 'auto' };
  static async requestTranslate(text, src, tgt) {
    return await httpJson('GET', 'https://translate.googleapis.com/translate_a/t', {
      searchParams: { client: 'dict-chrome-ex', sl: src || 'auto', tl: tgt, q: text },
    });
  }
  static async wrapResponse(data, text, src) {
    if (!Array.isArray(data)) return null;
    const first = Array.isArray(data[0]) ? data[0] : data;
    const targetText = Array.isArray(first) ? (first[0] || '') : String(first);
    const detected = Array.isArray(first) ? (first[1] || src) : src;
    return { targetText, detectedLang: detected };
  }
}

// ---- DeepL (free web jsonrpc) ----
class DeepLEngine extends BaseTranslator {
  static langCodeJson = {
    auto: 'auto', ar: 'AR', bg: 'BG', cs: 'CS', da: 'DA', de: 'DE', el: 'EL',
    en: 'EN', es: 'ES', et: 'ET', fi: 'FI', fr: 'FR', hu: 'HU', id: 'ID',
    it: 'IT', ja: 'JA', ko: 'KO', lt: 'LT', lv: 'LV', no: 'NB', nl: 'NL',
    pl: 'PL', pt: 'PT', ro: 'RO', ru: 'RU', sk: 'SK', sl: 'SL', sv: 'SV',
    tr: 'TR', uk: 'UK', 'zh-CN': 'ZH',
  };
  static async requestTranslate(text, src, tgt) {
    const id = (Math.floor(Math.random() * 99999) + 100000) * 1000;
    const iCount = text.split('i').length - 1;
    const now = Date.now();
    const stamp = iCount !== 0 ? (now - (now % (iCount + 1))) + (iCount + 1) : now;
    const payload = {
      jsonrpc: '2.0',
      method: 'LMT_handle_texts',
      id,
      params: {
        splitting: 'newlines',
        lang: { source_lang_user_selected: src, target_lang: tgt },
        texts: [{ text, requestAlternatives: 3 }],
        timestamp: stamp,
      },
    };
    let body = JSON.stringify(payload);
    body = ((id + 5) % 29 === 0 || (id + 3) % 13 === 0)
      ? body.replace('"method":"', '"method" : "')
      : body.replace('"method":"', '"method": "');
    return await httpJson('POST', 'https://www2.deepl.com/jsonrpc', {
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  }
  static async wrapResponse(resp) {
    if (resp && resp.result) {
      return { targetText: resp.result.texts[0].text, detectedLang: resp.result.lang };
    }
    return null;
  }
}

// ---- Bing (ttranslatev3) ----
class BingEngine extends BaseTranslator {
  static langCodeJson = {
    auto: 'auto-detect', ar: 'ar', bg: 'bg', bn: 'bn', cs: 'cs', da: 'da',
    de: 'de', el: 'el', en: 'en', es: 'es', et: 'et', fa: 'fa', fi: 'fi',
    fr: 'fr', he: 'he', iw: 'he', hi: 'hi', hu: 'hu', id: 'id', it: 'it',
    ja: 'ja', kk: 'kk', ko: 'ko', lt: 'lt', lv: 'lv', ms: 'ms', nl: 'nl',
    no: 'nb', pl: 'pl', pt: 'pt', 'pt-BR': 'pt', 'pt-PT': 'pt-pt',
    ro: 'ro', ru: 'ru', sk: 'sk', sl: 'sl', sv: 'sv', th: 'th', tr: 'tr',
    uk: 'uk', ur: 'ur', vi: 'vi', 'zh-CN': 'zh-Hans', 'zh-TW': 'zh-Hant',
  };
  static tokenUrl = 'https://www.bing.com/translator';
  static chinaTokenUrl = 'https://cn.bing.com/translator';
  static baseUrl = 'https://www.bing.com/ttranslatev3';
  static chinaBaseUrl = 'https://cn.bing.com/ttranslatev3';
  static accessToken = null;
  static useChina = false;

  static get userAgent() {
    return (typeof navigator !== 'undefined' && navigator.userAgent) || 'Mozilla/5.0';
  }

  static async fetchToken(tokenUrl) {
    const res = await http('GET', tokenUrl, { headers: { 'User-Agent': this.userAgent } });
    const html = res.text;
    const cookie = parseSetCookie(
      res.headers && (res.headers['set-cookie'] || res.headers['Set-Cookie'])
    );
    const IG = (html.match(/IG:"([^"]+)"/) || [])[1];
    const IID = (html.match(/data-iid="([^"]+)"/) || [])[1];
    const m = html.match(/params_AbusePreventionHelper\s?=\s?(\[[^\]]+\])/);
    if (!IG || !m) throw new Error('Bing token parse failed');
    // params_AbusePreventionHelper = [key, token, expiryInterval]
    const [key, token, expiryInterval] = JSON.parse(m[1]);
    return { IG, IID, key, token, tokenTs: Date.now(), expiryInterval, count: 0, cookie };
  }

  static async getAccessToken() {
    if (this.accessToken && Date.now() - this.accessToken.tokenTs <= this.accessToken.expiryInterval) {
      return this.accessToken;
    }
    // Try the global endpoint first, then fall back to the China endpoint.
    let lastErr;
    for (const china of [false, true]) {
      try {
        this.accessToken = await this.fetchToken(china ? this.chinaTokenUrl : this.tokenUrl);
        this.useChina = china;
        return this.accessToken;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('Bing token fetch failed');
  }

  static async requestTranslate(text, src, tgt) {
    const tk = await this.getAccessToken();
    const body = new URLSearchParams({ text, fromLang: src, to: tgt, token: tk.token, key: String(tk.key) });
    return await httpJson('POST', this.useChina ? this.chinaBaseUrl : this.baseUrl, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.userAgent,
        Referer: this.useChina ? this.chinaTokenUrl : this.tokenUrl,
        ...(tk.cookie ? { Cookie: tk.cookie } : {}),
      },
      searchParams: {
        IG: tk.IG,
        IID: tk.IID && tk.IID.length ? `${tk.IID}.${tk.count++}` : '',
        isVertical: '1',
      },
      body,
    });
  }

  static async wrapResponse(resp) {
    if (Array.isArray(resp) && resp[0] && resp[0].translations) {
      const t = resp[0];
      const transliteration = resp[1] ? (resp[1].inputTransliteration || '') : '';
      return {
        targetText: t.translations[0].text,
        detectedLang: t.detectedLanguage && t.detectedLanguage.language,
        transliteration,
      };
    }
    return null;
  }
}

// ---- Yandex ----
class YandexEngine extends BaseTranslator {
  static langCodeJson = {
    af: 'af', sq: 'sq', am: 'am', ar: 'ar', hy: 'hy', az: 'az', eu: 'eu',
    be: 'be', bn: 'bn', bs: 'bs', bg: 'bg', ca: 'ca', hr: 'hr', cs: 'cs',
    da: 'da', nl: 'nl', en: 'en', eo: 'eo', et: 'et', fi: 'fi', fr: 'fr',
    gl: 'gl', ka: 'ka', de: 'de', el: 'el', gu: 'gu', ht: 'ht', hi: 'hi',
    hu: 'hu', is: 'is', id: 'id', ga: 'ga', it: 'it', ja: 'ja', kn: 'kn',
    kk: 'kk', km: 'km', ko: 'ko', ky: 'ky', lo: 'lo', la: 'la', lv: 'lv',
    lt: 'lt', lb: 'lb', mk: 'mk', mg: 'mg', ms: 'ms', ml: 'ml', mt: 'mt',
    mi: 'mi', mr: 'mr', mn: 'mn', my: 'my', ne: 'ne', no: 'no', fa: 'fa',
    pl: 'pl', pt: 'pt', pa: 'pa', ro: 'ro', ru: 'ru', gd: 'gd', sr: 'sr',
    si: 'si', sk: 'sk', sl: 'sl', es: 'es', su: 'su', sw: 'sw', sv: 'sv',
    tg: 'tg', ta: 'ta', te: 'te', th: 'th', tr: 'tr', uk: 'uk', ur: 'ur',
    uz: 'uz', vi: 'vi', cy: 'cy', xh: 'xh', yi: 'yi', tl: 'tl', iw: 'he',
    jw: 'jv', 'zh-CN': 'zh',
  };
  static async requestTranslate(text, src, tgt) {
    const uuid = (nodeCrypto.randomUUID ? nodeCrypto.randomUUID() : require('crypto').randomBytes(16).toString('hex'))
      .replaceAll('-', '');
    const lang = src === 'auto' ? tgt : `${src}-${tgt}`;
    return await httpJson('POST', 'https://translate.yandex.net/api/v1/tr.json/translate', {
      searchParams: { id: `${uuid}-0-0`, srv: 'android' },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ lang, text }),
    });
  }
  static async wrapResponse(resp) {
    if (resp && String(resp.code) === '200') {
      return { targetText: resp.text[0], detectedLang: resp.lang.split('-')[0] };
    }
    return null;
  }
}

// ---- Papago (HMAC-MD5 signed) ----
class PapagoEngine extends BaseTranslator {
  static langCodeJson = {
    ar: 'ar', en: 'en', fa: 'fa', fr: 'fr', de: 'de', hi: 'hi', id: 'id',
    it: 'it', ja: 'ja', ko: 'ko', my: 'mm', pt: 'pt', ru: 'ru', es: 'es',
    th: 'th', vi: 'vi', 'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW',
  };
  static version = '';
  static endpoint = 'https://papago.naver.com/apis/n2mt/translate';
  static detectEndpoint = 'https://papago.naver.com/apis/langs/dect';

  static async getVersion() {
    if (this.version) return this.version;
    const home = await httpGetText('https://papago.naver.com/');
    const main = (home.match(/"\/main\.([^"]+)"/) || [])[1];
    if (!main) throw new Error('Papago main file lookup failed');
    const js = await httpGetText(`https://papago.naver.com/main.${main}`);
    const v = (js.match(/"v1\.([^"]+)"/) || [])[1];
    if (!v) throw new Error('Papago version lookup failed');
    this.version = `v1.${v}`;
    return this.version;
  }

  static async getToken(url) {
    const version = await this.getVersion();
    const uuid = nodeCrypto.randomUUID
      ? nodeCrypto.randomUUID()
      : require('crypto').randomBytes(16).toString('hex');
    const time = Date.now();
    const hash = nodeCrypto.createHmac('md5', version)
      .update(`${uuid}\n${url}\n${time}`)
      .digest('base64');
    return { uuid, time, hash };
  }

  static authHeaders(uuid, time, hash) {
    return {
      Authorization: `PPG ${uuid}:${hash}`,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Timestamp: String(time),
    };
  }

  static async requestTranslate(text, src, tgt) {
    if (src === 'auto') {
      const t = await this.getToken(this.detectEndpoint);
      const dect = await httpJson('POST', this.detectEndpoint, {
        searchParams: { query: text },
        headers: this.authHeaders(t.uuid, t.time, t.hash),
      });
      src = dect && dect.langCode ? dect.langCode : 'en';
    }
    const t = await this.getToken(this.endpoint);
    return await httpJson('POST', this.endpoint, {
      searchParams: {
        deviceId: t.uuid, locale: 'ko', dict: 'true', dictDisplay: '30',
        honorific: 'false', instant: 'false', paging: 'false',
        source: src, target: tgt, text,
      },
      headers: this.authHeaders(t.uuid, t.time, t.hash),
    });
  }
  static async wrapResponse(resp) {
    if (resp && resp.translatedText != null) {
      return { targetText: resp.translatedText, detectedLang: resp.srcLangType };
    }
    return null;
  }
}

// ---- Baidu (fanyi.baidu.com/transapi) ----
class BaiduEngine extends BaseTranslator {
  static langCodeJson = {
    en: 'en', ja: 'jp', ko: 'kor', fr: 'fra', es: 'spa', th: 'th', ar: 'ara',
    ru: 'ru', pt: 'pt', de: 'de', it: 'it', el: 'el', nl: 'nl', pl: 'pl',
    bg: 'bul', et: 'est', da: 'dan', fi: 'fin', cs: 'cs', ro: 'rom', sl: 'slo',
    sv: 'swe', hu: 'hu', vi: 'vie', 'zh-CN': 'zh', 'zh-TW': 'cht',
  };
  static async requestTranslate(text, src, tgt) {
    return httpJson('POST', 'https://fanyi.baidu.com/transapi', {
      searchParams: { from: src, to: tgt },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': (typeof navigator !== 'undefined' && navigator.userAgent) || 'Mozilla/5.0',
        Referer: 'https://fanyi.baidu.com/',
      },
      body: new URLSearchParams({
        from: src, to: tgt, query: text, source: 'txt', isAi: 'false',
        sseStartTime: String(Date.now()), reference: '', corpusIds: '',
        needPhonetic: 'false', domain: 'common', detectLang: '',
        milliTimestamp: String(Date.now()),
      }),
    });
  }
  static async wrapResponse(resp) {
    // Baidu also returns one entry per source segment, including newlines.
    const targetText = resp?.data?.[0]?.result?.map((item) => item?.[1]).filter(Boolean).join('');
    return targetText ? { targetText, detectedLang: resp.from, transliteration: '' } : null;
  }
}

// Chromium's built-in on-device Translator API, when available in Obsidian's Electron.
class BrowserAPIEngine extends BaseTranslator {
  static detector = null;
  static translators = {};
  static async requestTranslate(text, src, tgt) {
    if (typeof Translator === 'undefined' || typeof LanguageDetector === 'undefined') {
      throw new Error('Chrome Translator API is not available in this runtime.');
    }
    let detectedLang = src;
    if (src === 'auto') {
      if (!this.detector) this.detector = await LanguageDetector.create();
      const result = (await this.detector.detect(text))?.[0];
      if (!result || result.confidence <= 0.5) throw new Error('Language detection failed.');
      detectedLang = canonicalLanguageCode(result.detectedLanguage);
    }
    if (detectedLang === tgt) return { targetText: text, detectedLang };
    const availability = await Translator.availability({ sourceLanguage: detectedLang, targetLanguage: tgt });
    if (availability === 'unavailable') throw new Error(`Translator is unavailable for ${detectedLang} to ${tgt}.`);
    const key = `${detectedLang}-${tgt}`;
    if (!this.translators[key]) {
      this.translators[key] = await Translator.create({ sourceLanguage: detectedLang, targetLanguage: tgt });
    }
    return { targetText: await this.translators[key].translate(text), detectedLang };
  }
  static async wrapResponse(result) { return result; }
}

// Google Web returns an English dictionary definition, not a conventional translation.
class GoogleWebEngine extends BaseTranslator {
  static async requestTranslate(text) {
    return httpGetText('https://www.google.com/search', {
      searchParams: { q: `meaning:${text}`, hl: 'en', lr: 'lang_en' },
    });
  }
  static async wrapResponse(html, text) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const targetText = doc.querySelector('.eQJLDd')?.firstElementChild
      ?.querySelector("[data-dobid='dfn']")?.textContent || '';
    return targetText ? { targetText, detectedLang: await detectLangLocal(text), transliteration: '' } : null;
  }
}

// Google image search shows the first matching image in the normal tooltip.
class GoogleWebImageEngine extends BaseTranslator {
  static async requestTranslate(text) {
    return httpGetText('https://www.google.com/search', { searchParams: { q: text, tbm: 'isch' } });
  }
  static async wrapResponse(html, text) {
    const match = html.match(/google\.ldi=(\{[^{]+\});/);
    if (!match) return null;
    const images = JSON.parse(match[1]);
    const imageUrl = images[Object.keys(images)[0]];
    if (!imageUrl) return null;
    return {
      targetText: 'image', detectedLang: await detectLangLocal(text), transliteration: '',
      imageUrl: await getBase64(imageUrl),
    };
  }
}

let _googleV2Token = null;
const GOOGLE_V2_TOKEN_TTL = 60 * 60 * 1000;
async function getGoogleV2Token() {
  if (_googleV2Token && _googleV2Token.time + GOOGLE_V2_TOKEN_TTL > Date.now()) return _googleV2Token;
  const page = await httpGetText('https://translate.google.com');
  const sid = page.match(/"FdrFJe":"(.*?)"/)?.[1];
  const bl = page.match(/"cfb2h":"(.*?)"/)?.[1];
  if (!sid || !bl) throw new Error('Google V2 token parse failed.');
  _googleV2Token = { sid, bl, at: page.match(/"SNlM0e":"(.*?)"/)?.[1] || '', time: Date.now() };
  return _googleV2Token;
}

class GoogleV2Engine extends BaseTranslator {
  static async requestTranslate(text, src, tgt) {
    const { sid, bl, at } = await getGoogleV2Token();
    const req = JSON.stringify([[['MkEWBc', JSON.stringify([[text, src, tgt, true], [null]]), null, 'generic']]]);
    const res = await http('POST', 'https://translate.google.com/_/TranslateWebserverUi/data/batchexecute', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      searchParams: { rpcids: 'MkEWBc', 'source-path': '/', 'f.sid': sid, bl, hl: 'ko',
        'soc-app': 1, 'soc-platform': 1, 'soc-device': 1, _reqid: Math.floor(10000 + 10000 * Math.random()), rt: 'c' },
      body: new URLSearchParams({ 'f.req': req, at }),
    });
    return res.text;
  }
  static async wrapResponse(response) {
    const json = JSON.parse(JSON.parse(/\[.*\]/.exec(response))[0][2]);
    const targetText = json[1][0][0][5].map((item) => item?.[0]).filter(Boolean).join('');
    return targetText ? { targetText, detectedLang: json[0][2], transliteration: json[1][0][0][1] } : null;
  }
}

// ---- OpenAI-compatible LLM with provider profiles ----
const LLM_PROVIDER_ENDPOINTS = {
  custom: '', openai: 'https://api.openai.com/v1', claude: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai', grok: 'https://api.x.ai/v1',
  groq: 'https://api.groq.com/openai/v1', openrouter: 'https://openrouter.ai/api/v1',
  githubModels: 'https://models.inference.ai.azure.com', ollama: 'http://localhost:11434/v1',
  lmstudio: 'http://localhost:1234/v1',
};
const LLM_PROVIDER_LABELS = {
  custom: 'Custom', openai: 'OpenAI', claude: 'Claude (Anthropic)', gemini: 'Gemini (Google)',
  grok: 'Grok (xAI)', groq: 'Groq', openrouter: 'OpenRouter', githubModels: 'GitHub Models',
  ollama: 'Ollama (local)', lmstudio: 'LM Studio (local)',
};

class LocalLlmEngine extends BaseTranslator {
  static async translate(text, src, tgt, settings) {
    if (!settings?.llmApiEndpoint || !settings?.llmModel) {
      console.warn('[mtt] localLlm requires an API endpoint and model.');
      return null;
    }
    return super.translate(text, src, tgt, settings);
  }
  static async requestTranslate(text, src, tgt, settings) {
    const endpoint = settings.llmApiEndpoint.replace(/\/$/, '');
    const headers = { 'Content-Type': 'application/json' };
    if (settings.llmApiKey) headers.Authorization = `Bearer ${settings.llmApiKey}`;
    const source = src && src !== 'auto' ? ` from ${languageName(src)}` : '';
    return httpJson('POST', `${endpoint}/chat/completions`, {
      headers,
      body: {
        model: settings.llmModel,
        messages: [
          { role: 'system', content: 'Reply only with the source ISO language code, a tab, then the translation.' },
          { role: 'user', content: `Translate${source} to ${languageName(tgt)}. Preserve the source text's paragraph breaks and line breaks exactly.\n<text>\n${text}\n</text>` },
        ],
        temperature: 0.1,
      },
    });
  }
  static async wrapResponse(response) {
    const raw = String(response?.choices?.[0]?.message?.content || '');
    // The protocol delimiter is one tab or newline; consuming all adjacent
    // newlines would discard intentional leading blank paragraphs.
    const match = raw.match(/^([a-zA-Z]{2,3}(?:-[a-zA-Z]{2,4})?)(?:\t|\r?\n)([\s\S]*)$/);
    const targetText = match ? match[2] : raw;
    return targetText.trim() ? { targetText, detectedLang: match?.[1]?.toLowerCase() || '', transliteration: '' } : null;
  }
  static async getModels(endpoint, apiKey) {
    if (!endpoint) throw new Error(i18n().llmFetchNoEndpoint);
    const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
    const response = await httpJson('GET', `${endpoint.replace(/\/$/, '')}/models`, { headers });
    return (response.data || response.models || []).map((model) => model.id || model.name || model.model).filter(Boolean);
  }
}

// ---- LLM engines (OpenAI-compatible chat completions) ----
class LLMEngine extends BaseTranslator {
  static langCodeJson = {};

  static _buildPrompt(text, tgt, template) {
    const tgtName = COMMON_LANGS[tgt] || tgt;
    if (template && template.trim()) {
      return `${template.replace(/\{\{text\}\}/g, text).replace(/\{\{targetLang\}\}/g, tgtName)}\n\nPreserve the source text's paragraph breaks and line breaks exactly.`;
    }
    return `Translate the following text to ${tgtName}. Output only the translated text. Preserve the source text's paragraph breaks and line breaks exactly.\n\n${text}`;
  }

  static async _chatRequest(text, etgt, { url, model, apiKey, prompt, temperature }) {
    if (!model) throw new Error(i18n().llmModelRequired);
    const baseUrl = (url || '').trim().replace(/\/+$/, '');
    const endpoint = /\/chat\/completions$/i.test(baseUrl)
      ? baseUrl
      : /\/v1$/i.test(baseUrl)
        ? `${baseUrl}/chat/completions`
        : `${baseUrl}/v1/chat/completions`;
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    return httpJson('POST', endpoint, {
      headers,
      body: {
        model,
        messages: [{ role: 'user', content: this._buildPrompt(text, etgt, prompt) }],
        temperature: temperature ?? 0,
        stream: false,
      },
    });
  }

  static async requestTranslate() { throw new Error('not implemented'); }

  static async wrapResponse(raw) {
    if (raw?.error) throw new Error(raw.error.message || String(raw.error));
    const choice = raw?.choices?.[0];
    if (choice?.finish_reason === 'length') {
      throw new Error('Translation response was truncated by the model output limit');
    }
    const rawContent = choice?.message?.content ?? choice?.text;
    const content = Array.isArray(rawContent)
      ? rawContent.map(part => part?.text || part?.content || '').join('')
      : String(rawContent || '');
    if (!content.trim()) return null;
    return { targetText: content };
  }
}

class OllamaEngine extends LLMEngine {
  static async requestTranslate(text, _esrc, etgt, settings) {
    return this._chatRequest(text, etgt, {
      url: settings?.ollamaApiUrl || 'http://localhost:11434',
      model: settings?.ollamaModel || '',
      apiKey: '',
      prompt: settings?.ollamaPrompt || '',
      temperature: settings?.ollamaTemperature ?? 0,
    });
  }
}

class LMStudioEngine extends LLMEngine {
  static async requestTranslate(text, _esrc, etgt, settings) {
    return this._chatRequest(text, etgt, {
      url: settings?.lmstudioApiUrl || 'http://localhost:1234',
      model: settings?.lmstudioModel || '',
      apiKey: 'lm-studio',
      prompt: settings?.lmstudioPrompt || '',
      temperature: settings?.lmstudioTemperature ?? 0,
    });
  }
}

const ENGINE_CLASSES = {
  google: GoogleEngine,
  googleGTX: GoogleGTXEngine,
  deepl: DeepLEngine,
  bing: BingEngine,
  yandex: YandexEngine,
  baidu: BaiduEngine,
  papago: PapagoEngine,
  browserAPI: BrowserAPIEngine,
  googleWebImage: GoogleWebImageEngine,
  googleWeb: GoogleWebEngine,
  googleV2: GoogleV2Engine,
  localLlm: LocalLlmEngine,
  ollama: OllamaEngine,
  lmstudio: LMStudioEngine,
};

const ENGINE_LABELS = {
  google: 'Google',
  googleGTX: 'Google (translate_a/t)',
  deepl: 'DeepL (web, experimental)',
  bing: 'Bing (experimental)',
  yandex: 'Yandex (experimental)',
  baidu: 'Baidu (experimental)',
  papago: 'Papago (experimental)',
  browserAPI: 'Browser Translator API (experimental)',
  googleWebImage: 'Google Web Image (experimental)',
  googleWeb: 'Google Web Dictionary (experimental)',
  googleV2: 'Google V2 (experimental)',
  localLlm: 'OpenAI Compatible API',
  ollama: 'Ollama (local)',
  lmstudio: 'LM Studio (local)',
};

const LLM_ENGINE_KEYS = new Set(['localLlm', 'ollama', 'lmstudio']);

// The panel produces ordinary translated text, so exclude the dictionary and
// image-search modes whose result types are intentionally different.
const TRANSLATION_PANEL_ENGINE_KEYS = Object.keys(ENGINE_CLASSES)
  .filter((key) => !['googleWeb', 'googleWebImage'].includes(key));

// On failure, temporarily bench the failed web engine and try a stable
// alternative. Image and dictionary engines intentionally do not fall back:
// their result type is different from ordinary text translation.
const FALLBACK_ACT_LIST = ['google', 'googleGTX', 'bing', 'baidu', 'papago', 'deepl', 'yandex', 'googleV2'];
const FALLBACK_SWAP_LIST = ['google', 'bing', 'baidu'];
const FALLBACK_WAIT_TIME = 60 * 60 * 1000;
let fallbackCrashTime = Object.fromEntries(FALLBACK_SWAP_LIST.map((key, index) => [key, index + 1]));
let fallbackCrashCount = {};

async function translateWithFallback(text, src, tgt, engine, settings, retry = 0) {
  if (retry === 0 && Object.values(fallbackCrashTime).every((time) => Date.now() < time)) {
    fallbackCrashTime = Object.fromEntries(FALLBACK_SWAP_LIST.map((key, index) => [key, index + 1]));
    fallbackCrashCount = {};
  }
  if (retry > FALLBACK_SWAP_LIST.length) return null;

  const engineClass = ENGINE_CLASSES[engine] || ENGINE_CLASSES.google;
  const enabled = settings?.fallbackTranslatorEngine !== false && FALLBACK_ACT_LIST.includes(engine);
  fallbackCrashCount[engine] ??= 0;
  fallbackCrashTime[engine] ??= 0;
  let result = (fallbackCrashTime[engine] < Date.now() || !enabled)
    ? await engineClass.translate(text, src, tgt, settings)
    : null;
  if (enabled && !result) {
    fallbackCrashCount[engine]++;
    fallbackCrashTime[engine] = Date.now() + FALLBACK_WAIT_TIME * fallbackCrashCount[engine];
    const replacement = FALLBACK_SWAP_LIST
      .filter((key) => key !== engine)
      .sort((a, b) => (fallbackCrashTime[a] || 0) - (fallbackCrashTime[b] || 0))[0];
    if (replacement) result = await translateWithFallback(text, src, tgt, replacement, settings, retry + 1);
  }
  return result;
}

const ENGINES = Object.fromEntries(
  Object.entries(ENGINE_CLASSES).map(([k, C]) => [
    k,
    {
      label: ENGINE_LABELS[k] || k,
      translate: (text, src, tgt, settings) => translateWithFallback(text, src, tgt, k, settings),
    },
  ])
);

function mappedLanguageCodes(engineClass) {
  return new Set(Object.keys(engineClass.langCodeJson || {})
    .map(canonicalLanguageCode)
    .filter((code) => code === 'auto' || Object.prototype.hasOwnProperty.call(CANONICAL_LANGUAGES, code)));
}

const PAPAGO_CORE_CODES = new Set([
  'auto', 'ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'vi', 'th', 'id', 'ru',
  'de', 'fr', 'es', 'it', 'ar', 'hi', 'pt',
]);

/*
 * Per-engine capability adapters. `catalog` describes the origin of the data
 * currently used by the picker. The web engines remain deliberately labelled
 * bundled/experimental: their endpoints do not expose an official, stable
 * language-discovery API. Adding an official API engine later only requires
 * supplying its live source/target code lists here.
 */
function getEngineCapabilities(engineKey) {
  const all = new Set(ALL_CANONICAL_SOURCE_CODES);
  const webCatalog = (engineClass) => {
    const source = mappedLanguageCodes(engineClass);
    source.add('auto');
    return {
      sources: source,
      targets: new Set([...source].filter((code) => code !== 'auto')),
      catalog: 'bundled',
      live: false,
    };
  };

  switch (engineKey) {
    case 'google':
    case 'googleGTX':
    case 'googleV2':
    case 'googleWeb':
    case 'googleWebImage':
    case 'browserAPI':
      return { sources: all, targets: new Set(ALL_CANONICAL_TARGET_CODES), catalog: 'bundled', live: false };
    case 'deepl': return webCatalog(DeepLEngine);
    case 'bing': return webCatalog(BingEngine);
    case 'yandex': return webCatalog(YandexEngine);
    case 'baidu': return webCatalog(BaiduEngine);
    case 'papago':
      return {
        sources: PAPAGO_CORE_CODES,
        targets: new Set([...PAPAGO_CORE_CODES].filter((code) => code !== 'auto')),
        catalog: 'bundled',
        live: false,
        // Papago documents Hindi and Portuguese only in pairs with English.
        supportsPair: (source, target) => (
          (!['hi', 'pt'].includes(source) && !['hi', 'pt'].includes(target))
          || source === 'en' || target === 'en'
        ),
      };
    case 'ollama':
    case 'lmstudio':
    case 'localLlm':
      // Models decide their real coverage. Keep the canonical picker open, but
      // label it as model-defined rather than claiming vendor support.
      return { sources: all, targets: new Set(ALL_CANONICAL_TARGET_CODES), catalog: 'model', live: false };
    default:
      return { sources: all, targets: new Set(ALL_CANONICAL_TARGET_CODES), catalog: 'bundled', live: false };
  }
}

function getSupportedLanguageOptions(engineKeys, type) {
  const keys = [...new Set((engineKeys || []).filter(Boolean))];
  const capabilitySets = (keys.length ? keys : ['google'])
    .map((key) => getEngineCapabilities(key)[type]);
  const candidates = type === 'sources' ? ALL_CANONICAL_SOURCE_CODES : ALL_CANONICAL_TARGET_CODES;
  return candidates.filter((code) => capabilitySets.every((set) => set.has(code)));
}

function getPairCompatibleLanguageOptions(engineKeys, type, otherLanguage) {
  const keys = [...new Set((engineKeys || []).filter(Boolean))];
  const candidates = getSupportedLanguageOptions(keys, type);
  if (!otherLanguage) return candidates;
  return candidates.filter((candidate) => {
    const source = type === 'sources' ? candidate : otherLanguage;
    const target = type === 'targets' ? candidate : otherLanguage;
    return (keys.length ? keys : ['google']).every((key) => supportsLanguagePair(key, source, target));
  });
}

function supportsLanguagePair(engineKey, source, target) {
  const capabilities = getEngineCapabilities(engineKey);
  const src = canonicalLanguageCode(source || 'auto');
  const tgt = canonicalLanguageCode(target);
  if (!capabilities.sources.has(src) || !capabilities.targets.has(tgt)) return false;
  return !capabilities.supportsPair || capabilities.supportsPair(src, tgt);
}

function languagePairError(engineKey, source, target) {
  return i18n().languagePairUnsupported(
    ENGINE_LABELS[engineKey] || engineKey,
    languageOptionLabel(canonicalLanguageCode(source || 'auto')),
    languageOptionLabel(canonicalLanguageCode(target)),
  );
}

function isWordChar(c) {
  return !!c && /[\p{L}\p{N}'\-_]/u.test(c);
}

function isSentenceBoundary(c) {
  return /[.!?。！？\n\r]/.test(c);
}

function caretRange(x, y) {
  if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
  if (document.caretPositionFromPoint) {
    const p = document.caretPositionFromPoint(x, y);
    if (!p) return null;
    const r = document.createRange();
    r.setStart(p.offsetNode, p.offset);
    r.setEnd(p.offsetNode, p.offset);
    return r;
  }
  return null;
}

function extractAtPoint(x, y, mode) {
  const range = caretRange(x, y);
  if (!range) return null;
  const node = range.startContainer;
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  const text = node.textContent;
  if (!text) return null;
  const off = range.startOffset;

  let start = off, end = off;
  if (mode === 'sentence') {
    while (start > 0 && !isSentenceBoundary(text[start - 1])) start--;
    while (end < text.length && !isSentenceBoundary(text[end])) end++;
  } else {
    while (start > 0 && isWordChar(text[start - 1])) start--;
    while (end < text.length && isWordChar(text[end])) end++;
  }
  const slice = text.slice(start, end).trim();
  if (!slice) return null;

  const wordRange = document.createRange();
  wordRange.setStart(node, start);
  wordRange.setEnd(node, end);
  const rect = wordRange.getBoundingClientRect();
  // make sure the cursor is actually inside the rect (caretRangeFromPoint can snap)
  if (x < rect.left - 4 || x > rect.right + 4 || y < rect.top - 4 || y > rect.bottom + 4) return null;
  return { text: slice, rect };
}

/* DISABLED: translation-log persistence and the Open Vocabulary list.
// Persists translation history to translation-log.json in the plugin folder.
// Each entry records the source/target text, languages, and view count.
// Writes are debounced to 2 s to avoid hammering the filesystem on every hover.
class TranslationLog {
  constructor(app, pluginDir) {
    this.app = app;
    this.filePath = `${pluginDir}/translation-log.json`;
    this.entries = {};
    this.saveTimer = null;
  }

  async load() {
    try {
      if (await this.app.vault.adapter.exists(this.filePath)) {
        const raw = await this.app.vault.adapter.read(this.filePath);
        const data = JSON.parse(raw);
        if (data && typeof data.entries === 'object') this.entries = data.entries;
      }
    } catch (e) {
      console.warn('[mtt] translation-log load failed:', e);
      this.entries = {};
    }
  }

  record(key, result, sourceText) {
    const now = Date.now();
    const hasDict = Array.isArray(result.dict) && result.dict.length > 0;
    if (this.entries[key]) {
      this.entries[key].count++;
      this.entries[key].lastSeen = now;
      // Backfill pos/type if the first hit lacked dict data but this one has it.
      if (hasDict && this.entries[key].pos.length === 0) {
        this.entries[key].pos = result.dict;
        this.entries[key].type = 'word';
      }
    } else {
      this.entries[key] = {
        sourceText,
        targetText: result.targetText,
        sourceLang: result.sourceLang,
        targetLang: result.targetLang,
        pos: hasDict ? result.dict : [],
        type: hasDict ? 'word' : 'sentence',
        count: 1,
        firstSeen: now,
        lastSeen: now,
      };
    }
    this._scheduleSave();
  }

  _scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this._flush(), 2000);
  }

  async _flush() {
    this.saveTimer = null;
    try {
      await this.app.vault.adapter.write(
        this.filePath,
        JSON.stringify({ version: 1, entries: this.entries }, null, 2)
      );
    } catch (e) {
      console.warn('[mtt] translation-log save failed:', e);
    }
  }

  async destroy() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      await this._flush();
    }
  }
}
*/

// Written to glossary.json every time the plugin loads.
const DEFAULT_GLOSSARY = {
  "version": 1,
  "revision": 1,
  "entries": [
    {
      "id": "term0001",
      "source": "真佛宗",
      "sourceLang": "zh-TW",
      "targets": {
        "en": "True Buddha School"
      },
      "aliases": [],
      "match": "exact",
      "caseSensitive": false,
      "enabled": true,
      "priority": 100
    },
    {
      "id": "term0002",
      "source": "蓮花童子",
      "sourceLang": "zh-TW",
      "targets": {
        "en": "Padmakumara"
      },
      "aliases": [],
      "match": "exact",
      "caseSensitive": false,
      "enabled": true,
      "priority": 100
    },
    {
      "id": "term0003",
      "source": "大禮拜",
      "sourceLang": "zh-TW",
      "targets": {
        "en": "Great Homage"
      },
      "aliases": [],
      "match": "exact",
      "caseSensitive": false,
      "enabled": true,
      "priority": 100
    },
    {
      "id": "term0004",
      "source": "南方寶生佛",
      "sourceLang": "zh-TW",
      "targets": {
        "en": "Ratnasambhava Buddha of the South"
      },
      "aliases": [],
      "match": "exact",
      "caseSensitive": false,
      "enabled": true,
      "priority": 100
    },
    {
      "id": "term0005",
      "source": "瑤池金母",
      "sourceLang": "zh-TW",
      "targets": {
        "en": "Golden Mother of the Jade Pond"
      },
      "aliases": [
        "金母"
      ],
      "match": "exact",
      "caseSensitive": false,
      "enabled": true,
      "priority": 100
    },
    {
      "id": "term0006",
      "source": "師尊",
      "sourceLang": "zh-TW",
      "targets": {
        "en": "Grand Master"
      },
      "aliases": [],
      "match": "exact",
      "caseSensitive": false,
      "enabled": true,
      "priority": 100
    },
    {
      "id": "term0007",
      "source": "師母",
      "sourceLang": "zh-TW",
      "targets": {
        "en": "Grand Madam"
      },
      "aliases": [],
      "match": "exact",
      "caseSensitive": false,
      "enabled": true,
      "priority": 100
    },
    {
      "id": "term0008",
      "source": "師佛",
      "sourceLang": "zh-TW",
      "targets": {
        "en": "Guru Buddha"
      },
      "aliases": [],
      "match": "exact",
      "caseSensitive": false,
      "enabled": true,
      "priority": 100
    },
    {
      "id": "term0009",
      "source": "高王觀世音菩薩",
      "sourceLang": "zh-TW",
      "targets": {
        "en": "High King Avalokiteshvara Bodhisattva"
      },
      "aliases": [],
      "match": "exact",
      "caseSensitive": false,
      "enabled": true,
      "priority": 100
    },
    {
      "id": "term0010",
      "source": "盧勝彥",
      "sourceLang": "zh-TW",
      "targets": {
        "en": "Sheng-Yen Lu"
      },
      "aliases": [],
      "match": "exact",
      "caseSensitive": false,
      "enabled": true,
      "priority": 100
    },
    {
      "id": "term0011",
      "source": "聖尊蓮生活佛",
      "sourceLang": "zh-TW",
      "targets": {
        "en": "His Holiness Living Buddha Lian Sheng"
      },
      "aliases": [],
      "match": "exact",
      "caseSensitive": false,
      "enabled": true,
      "priority": 100
    },
    {
      "id": "term0012",
      "source": "護摩",
      "sourceLang": "zh-TW",
      "targets": {
        "en": "homa"
      },
      "aliases": [],
      "match": "exact",
      "caseSensitive": false,
      "enabled": true,
      "priority": 100
    },
    {
      "id": "term0013",
      "source": "真佛宗傳承祖師",
      "sourceLang": "zh-TW",
      "targets": {
        "en": "lineage gurus of True Buddha School"
      },
      "aliases": [],
      "match": "exact",
      "caseSensitive": false,
      "enabled": true,
      "priority": 100
    },
    {
      "id": "term0014",
      "source": "華光自在佛",
      "sourceLang": "zh-TW",
      "targets": {
        "en": "Lotus Light Perfect Ease Buddha"
      },
      "aliases": [],
      "match": "exact",
      "caseSensitive": false,
      "enabled": true,
      "priority": 100
    },
    {
      "id": "term0015",
      "source": "大力金剛",
      "sourceLang": "zh-TW",
      "targets": {
        "en": "Mahabala"
      },
      "aliases": [],
      "match": "exact",
      "caseSensitive": false,
      "enabled": true,
      "priority": 100
    }
  ]
};

// Glossary entries are stored independently of translation history and have no
// engine-specific cache keys, so a preferred term applies everywhere.
class GlossaryStore {
  constructor(app, pluginDir) {
    this.app = app;
    this.filePath = `${pluginDir}/glossary.json`;
    this.entries = [];
    this.revision = 0;
  }

  async load() {
    this.entries = [];
    this.revision = 0;
    try {
      await this.app.vault.adapter.write(
        this.filePath,
        JSON.stringify(DEFAULT_GLOSSARY, null, 2)
      );
      const data = JSON.parse(await this.app.vault.adapter.read(this.filePath));
      if (!data || data.version !== 1 || !Array.isArray(data.entries)) {
        throw new Error('expected version 1 with an entries array');
      }
      this.revision = Number.isInteger(data.revision) && data.revision > 0 ? data.revision : 1;
      this.entries = data.entries
        .filter(entry => entry && entry.enabled !== false && typeof entry.source === 'string'
          && typeof entry.sourceLang === 'string' && entry.targets && typeof entry.targets === 'object')
        .map(entry => ({
          source: entry.source.trim(),
          sourceLang: entry.sourceLang.trim(),
          targets: entry.targets,
          aliases: Array.isArray(entry.aliases) ? entry.aliases.filter(alias => typeof alias === 'string') : [],
          // `phrase` was the pre-release name for contains. Keep old exports
          // working after the clearer Excel terminology is introduced.
          match: entry.match === 'phrase' ? 'contains'
            : ['exact', 'contains', 'regex'].includes(entry.match) ? entry.match : 'exact',
          caseSensitive: entry.caseSensitive === true,
          priority: Number.isFinite(entry.priority) ? entry.priority : 0,
        }))
        .filter(entry => entry.source);
    } catch (e) {
      console.warn('[mtt] glossary load failed:', e);
      this.entries = [];
      this.revision = 0;
    }
  }

  cacheKey() { return `g${this.revision}`; }

  _same(left, right, caseSensitive) {
    const a = String(left).trim();
    const b = String(right).trim();
    return caseSensitive ? a === b : a.toLocaleLowerCase() === b.toLocaleLowerCase();
  }

  _candidates(sourceLang, targetLang, embeddedOnly = false) {
    const explicitSource = sourceLang && sourceLang !== 'auto';
    return this.entries.flatMap(entry => {
      if (embeddedOnly && entry.match === 'exact') return [];
      if (explicitSource && entry.sourceLang !== sourceLang) return [];
      const targetText = entry.targets[targetLang];
      if (typeof targetText !== 'string' || !targetText.trim()) return [];
      return [entry.source, ...entry.aliases].map(source => ({
        source: source.trim(), targetText: targetText.trim(), sourceLang: entry.sourceLang,
        match: entry.match, caseSensitive: entry.caseSensitive, priority: entry.priority,
      })).filter(candidate => candidate.source);
    }).sort((a, b) => b.source.length - a.source.length || b.priority - a.priority);
  }

  prepare(text, sourceLang, targetLang) {
    if (!this.entries.length) return { text, replacements: [], exact: null };
    const candidates = this._candidates(sourceLang, targetLang);
    const exact = candidates.find(candidate => this._same(text, candidate.source, candidate.caseSensitive));
    if (exact) return { text, replacements: [], exact };

    // Contains and regex rules are protected inside a longer request. Scan
    // left to right and retain the longest/highest-priority match at a point.
    const embedded = this._candidates(sourceLang, targetLang, true);
    if (!embedded.length) return { text, replacements: [], exact: null };
    const lowered = text.toLocaleLowerCase();
    let cursor = 0;
    let output = '';
    const replacements = [];
    while (cursor < text.length) {
      const hits = embedded.flatMap(candidate => {
        if (candidate.match === 'regex') {
          try {
            const flags = candidate.caseSensitive ? '' : 'i';
            const match = new RegExp(`^(?:${candidate.source})`, flags).exec(text.slice(cursor));
            return match?.[0] ? [{ ...candidate, length: match[0].length }] : [];
          } catch (e) {
            console.warn('[mtt] invalid glossary regex:', candidate.source, e);
            return [];
          }
        }
        const sample = text.slice(cursor, cursor + candidate.source.length);
        const matches = candidate.caseSensitive
          ? sample === candidate.source
          : lowered.slice(cursor, cursor + candidate.source.length) === candidate.source.toLocaleLowerCase();
        return matches ? [{ ...candidate, length: candidate.source.length }] : [];
      }).sort((a, b) => b.length - a.length || b.priority - a.priority);
      const hit = hits[0];
      if (!hit) { output += text[cursor++]; continue; }
      const token = `⟪MTTG${replacements.length}⟫`;
      replacements.push({ token, targetText: hit.targetText });
      output += token;
      cursor += hit.length;
    }
    return { text: output, replacements, exact: null };
  }

  apply(result, prepared, requestedSource, targetLang) {
    if (!prepared) return result;
    if (prepared.exact) {
      return {
        targetText: prepared.exact.targetText,
        sourceLang: requestedSource === 'auto' ? prepared.exact.sourceLang : requestedSource,
        targetLang,
        transliteration: '', dict: null,
        glossaryMatch: true,
      };
    }
    if (!result?.targetText || !prepared.replacements.length) return result;
    let targetText = result.targetText;
    for (const { token, targetText: replacement } of prepared.replacements) {
      // Translation services normally preserve these uncommon markers. Allow
      // harmless spaces inside them as a defensive recovery for LLM output.
      const marker = new RegExp(token.replace(/[⟪⟫]/g, '\\$&').replace(/MTTG(\d+)/, 'MTTG\\s*$1\\s*'), 'g');
      targetText = targetText.replace(marker, replacement);
    }
    return { ...result, targetText, glossaryMatch: targetText !== result.targetText };
  }
}

class TooltipManager {
  constructor(plugin /*, log */) {
    this.plugin = plugin;
    // DISABLED: transaction-log recording.
    // this.log = log;
    this.el = null;
    this.token = 0;
    this.lastText = '';
    this.lastResult = null;
    this.cache = new Map();
    this.maxCache = 1000;
  }
  ensure() {
    if (this.el) return this.el;
    const el = document.createElement('div');
    el.className = 'mtt-tooltip';
    el.style.display = 'none';
    document.body.appendChild(el);
    this.el = el;
    return el;
  }
  hide() {
    this.lastText = '';
    this.lastResult = null;
    this.token++;
    if (this.el) this.el.style.display = 'none';
  }
  // Show plain text (no translation API call) — used when hovering over a
  // page-translated paragraph to display the pre-translation original.
  showPlain(text, rect) {
    if (!text) { this.hide(); return; }
    if (text === this.lastText && this.el && this.el.style.display !== 'none') {
      this.position(rect);
      return;
    }
    this.lastText = text;
    this.token++;
    const el = this.ensure();
    el.empty ? el.empty() : (el.textContent = '');
    const label = document.createElement('div');
    label.className = 'mtt-orig-label';
    label.textContent = i18n().origLabel;
    el.appendChild(label);
    const sep = document.createElement('div');
    sep.className = 'mtt-orig-sep';
    el.appendChild(sep);
    const main = document.createElement('div');
    main.className = 'mtt-target mtt-orig-preview';
    main.textContent = text;
    el.appendChild(main);
    el.style.display = 'block';
    this.position(rect);
  }
  isOwn(target) {
    return !!(this.el && target instanceof Node && this.el.contains(target));
  }
  cacheGet(key) { return this.cache.get(key); }
  cacheSet(key, val, sourceText) {
    if (this.cache.size >= this.maxCache) {
      const k = this.cache.keys().next().value;
      this.cache.delete(k);
    }
    this.cache.set(key, val);
    // DISABLED: transaction-log recording and Vocabulary list refresh.
    // if (this.log) this.log.record(key, val, sourceText);
    // if (this.plugin) {
    //   this.plugin.app.workspace.getLeavesOfType(VOCAB_VIEW_TYPE)
    //     .forEach(l => { if (l.view && l.view.refresh) l.view.refresh(); });
    // }
  }

  // A tooltip can be created from a long text selection.  Sending that whole
  // selection as one request makes web engines and OpenAI-compatible models
  // prone to returning only the first part of the translation.  Keep normal
  // word/sentence hover requests as a single call, while splitting larger
  // selections at sentence boundaries.
  _splitTranslationText(text, maxLength) {
    if (text.length <= maxLength) return [text];
    const parts = text.match(/[^.!?。！？\n]+[.!?。！？\n]*|.+$/gu) || [text];
    const chunks = [];
    let current = '';
    for (const part of parts) {
      if (part.length > maxLength) {
        if (current.trim()) chunks.push(current.trim());
        current = '';
        for (let start = 0; start < part.length; start += maxLength) {
          const chunk = part.slice(start, start + maxLength).trim();
          if (chunk) chunks.push(chunk);
        }
      } else if (current.length + part.length > maxLength) {
        if (current.trim()) chunks.push(current.trim());
        current = part;
      } else {
        current += part;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.filter(Boolean);
  }

  async _translateCompletely(text, eng, engine, sourceLang, targetLang, isCurrent) {
    // Many compatible local/remote LLM servers default to a small completion
    // limit.  A conservative input size prevents a translated selection from
    // being silently cut off at that model limit.
    const maxLength = LLM_ENGINE_KEYS.has(engine) ? 700 : 1800;
    const chunks = this._splitTranslationText(text, maxLength);
    const results = [];

    for (let index = 0; index < chunks.length; index++) {
      const chunk = chunks[index];
      let result = null;
      for (let attempt = 0; attempt < 3 && !result?.targetText; attempt++) {
        if (!isCurrent()) return null;
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, 350 * (2 ** (attempt - 1))));
        }
        result = await this.plugin.translateWithGlossary(chunk, sourceLang, targetLang, engine);
      }
      if (!result?.targetText || !isCurrent()) return null;
      results.push(result);
      if (index < chunks.length - 1) await new Promise(resolve => setTimeout(resolve, 120));
    }

    if (results.length === 1) return results[0];
    const first = results[0];
    return {
      targetText: results.map(result => result.targetText.trim()).join(' ').replace(/ \n/g, '\n').trim(),
      sourceLang: first.sourceLang,
      targetLang: first.targetLang,
      // Dictionary entries describe individual fragments, so they would be
      // misleading for a combined selection.  Show the complete translation.
      dict: null,
      transliteration: results.map(result => result.transliteration || '').filter(Boolean).join(' ').trim(),
    };
  }

  async show(text, rect, engineKey) {
    if (!text) return;
    const { sourceLang, targetLang } = this.plugin.settings;
    const engine = engineKey || 'google';
    if (text === this.lastText && this.el && this.el.style.display !== 'none') {
      this.position(rect);
      return;
    }

    // Short-circuit when source/target are explicitly the same — no API call needed.
    if (sourceLang !== 'auto' && sourceLang === targetLang) {
      this.hide();
      return;
    }

    const key = `v3|${this.plugin.glossary.cacheKey()}|${engine}|${sourceLang}|${targetLang}|${text}`;
    const cached = this.plugin.settings.disableCache ? null : this.cacheGet(key);
    // Sync no-op check on cache hit — avoids flashing the "…" loading state.
    if (cached && isNoopTranslation(cached, text, this.plugin.settings)) {
      this.hide();
      return;
    }

    this.lastText = text;
    const my = ++this.token;

    const el = this.ensure();
    el.style.display = 'none';
    this.position(rect);

    let result = cached;
    if (!result) {
      try {
        const eng = ENGINES[engine] || ENGINES.google;
        this.plugin.assertLanguagePairSupported(engine, sourceLang, targetLang);
        result = await this._translateCompletely(
          text, eng, engine, sourceLang, targetLang, () => my === this.token
        );
      } catch (e) {
        if (my === this.token) {
          el.textContent = `⚠ ${e.message || e}`;
          el.style.display = 'block';
          this.position(rect);
        }
        return;
      }
      if (result && result.targetText) this.cacheSet(key, result, text);
    }
    if (my !== this.token) return;
    if (!result || !result.targetText) {
      el.textContent = i18n().noTranslation;
      el.style.display = 'block';
      this.position(rect);
      return;
    }
    if (isNoopTranslation(result, text, this.plugin.settings)) {
      this.hide();
      return;
    }
    this.lastResult = result;
    this._notifyTransView(text, result);
    el.empty ? el.empty() : (el.textContent = '');

    // Always show the actual translation.  Previously, when Google returned a
    // dictionary result, the dictionary replaced targetText completely.  That
    // made tooltips appear only partially translated.
    const main = document.createElement('div');
    main.className = 'mtt-target';
    main.textContent = result.targetText;
    el.appendChild(main);

    if (result.imageUrl) {
      const image = document.createElement('img');
      image.className = 'mtt-image';
      image.src = result.imageUrl;
      image.alt = text;
      image.style.cssText = 'display:block;max-width:280px;max-height:220px;margin-top:6px;object-fit:contain;';
      el.appendChild(image);
    }

    const showDict = this.plugin.settings.showDictionary
      && Array.isArray(result.dict) && result.dict.length > 0;

    if (showDict) {
      const dictWrap = document.createElement('div');
      dictWrap.className = 'mtt-dict';
      for (const { pos, terms } of result.dict) {
        const row = document.createElement('div');
        row.className = 'mtt-dict-row';
        if (pos) {
          const posEl = document.createElement('b');
          posEl.className = 'mtt-pos';
          posEl.textContent = pos;
          row.appendChild(posEl);
          row.appendChild(document.createTextNode(': '));
        }
        const termsEl = document.createElement('span');
        termsEl.className = 'mtt-terms';
        termsEl.textContent = (terms || []).join(', ');
        row.appendChild(termsEl);
        dictWrap.appendChild(row);
      }
      el.appendChild(dictWrap);
    }

    if (this.plugin.settings.showTransliteration && result.transliteration) {
      const translit = document.createElement('div');
      translit.className = 'mtt-translit';
      translit.textContent = result.transliteration;
      el.appendChild(translit);
    }
    if (this.plugin.settings.showSourceText) {
      const src = document.createElement('div');
      src.className = 'mtt-source';
      src.textContent = text;
      el.appendChild(src);
    }
    if (this.plugin.settings.showDetectedLang && result.sourceLang) {
      const meta = document.createElement('div');
      meta.className = 'mtt-meta';
      meta.textContent = `${result.sourceLang} → ${result.targetLang}`;
      el.appendChild(meta);
    }
    el.style.display = 'block';
    this.position(rect);
  }
  position(rect) {
    if (!this.el || !rect) return;
    const pad = 8;
    const w = this.el.offsetWidth || 200;
    const h = this.el.offsetHeight || 30;
    let x = rect.left;
    let y;
    if (Platform.isMobile) {
      // Upper half → show above finger; lower half → show below finger
      if (rect.top < window.innerHeight / 2) {
        y = rect.top - h - pad;
      } else {
        y = rect.bottom + pad;
      }
    } else {
      y = rect.bottom + pad;
      if (y + h > window.innerHeight) y = rect.top - h - pad;
    }
    if (y < 0) y = pad;
    if (y + h > window.innerHeight) y = window.innerHeight - h - pad;
    if (x + w > window.innerWidth) x = window.innerWidth - w - pad;
    if (x < 0) x = pad;
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;
  }
  _notifyTransView(text, result) {
    if (!this.plugin) return;
    this.plugin.app.workspace.getLeavesOfType(TRANS_VIEW_TYPE)
      .forEach(l => { if (l.view?.update) l.view.update(text, result); });
  }
  async destroy() {
    this.hide();
    if (this.el) { this.el.remove(); this.el = null; }
    this.cache.clear();
    // DISABLED: transaction-log flush during plugin unload.
    // if (this.log) await this.log.destroy();
  }
}

/* DISABLED: Open Vocabulary list view.
const VOCAB_VIEW_TYPE = 'mtt-vocab-view';

class VocabView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this._sort = 'count-desc';
    this._filter = 'word';
    this._listEl = null;
  }

  getViewType() { return VOCAB_VIEW_TYPE; }
  getDisplayText() { return i18n().vocabTitle; }
  getIcon() { return 'book-open'; }

  async onOpen() { this.render(); }

  render() {
    const root = this.containerEl.children[1];
    root.empty();
    root.addClass('mtt-vocab-root');

    const header = root.createEl('div', { cls: 'mtt-vocab-header' });
    const s = i18n();
    header.createEl('span', { cls: 'mtt-vocab-title', text: s.vocabTitle });
    const reload = header.createEl('button', { cls: 'mtt-vocab-reload', title: s.vocabReload });
    reload.textContent = '↻';
    reload.addEventListener('click', () => this.refresh());

    const controls = root.createEl('div', { cls: 'mtt-vocab-controls' });

    const sortSelect = controls.createEl('select', { cls: 'mtt-vocab-sort' });
    for (const [value, label] of [
      ['count-desc', s.sortByCount],
      ['last-desc', s.sortByRecent],
      ['alpha', s.sortAlpha],
    ]) {
      const opt = sortSelect.createEl('option', { text: label });
      opt.value = value;
      if (value === this._sort) opt.selected = true;
    }
    sortSelect.addEventListener('change', () => { this._sort = sortSelect.value; this.refresh(); });

    const filterWrap = controls.createEl('div', { cls: 'mtt-vocab-filter-wrap' });
    for (const [value, label] of [['all', s.filterAll], ['word', s.filterWord], ['sentence', s.filterSentence]]) {
      const btn = filterWrap.createEl('button', { cls: 'mtt-vocab-filter-btn', text: label });
      btn.dataset.filter = value;
      if (value === this._filter) btn.addClass('is-active');
      btn.addEventListener('click', () => {
        this._filter = value;
        filterWrap.querySelectorAll('.mtt-vocab-filter-btn').forEach(b =>
          b.classList.toggle('is-active', b.dataset.filter === value)
        );
        this.refresh();
      });
    }

    this._listEl = root.createEl('div', { cls: 'mtt-vocab-list' });
    this._renderList();
  }

  refresh() {
    if (this._listEl) this._renderList();
  }

  _renderList() {
    const container = this._listEl;
    container.empty();
    const entries = Object.values(this.plugin.log.entries);

    let filtered = entries;
    if (this._filter === 'word') filtered = entries.filter(e => e.type === 'word');
    else if (this._filter === 'sentence') filtered = entries.filter(e => e.type === 'sentence');

    const sorted = [...filtered];
    if (this._sort === 'count-desc') sorted.sort((a, b) => b.count - a.count);
    else if (this._sort === 'last-desc') sorted.sort((a, b) => b.lastSeen - a.lastSeen);
    else sorted.sort((a, b) => a.sourceText.localeCompare(b.sourceText));

    if (sorted.length === 0) {
      container.createEl('div', { cls: 'mtt-vocab-empty', text: i18n().vocabEmpty });
      return;
    }

    for (const entry of sorted) {
      const card = container.createEl('div', { cls: 'mtt-vocab-card' });
      const main = card.createEl('div', { cls: 'mtt-vocab-main' });
      main.createEl('span', { cls: 'mtt-vocab-source', text: entry.sourceText });
      main.createEl('span', { cls: 'mtt-vocab-sep', text: ' → ' });
      main.createEl('span', { cls: 'mtt-vocab-target', text: entry.targetText });
      main.createEl('span', { cls: 'mtt-vocab-count', text: `×${entry.count}` });
      const copyBtn = main.createEl('button', { cls: 'mtt-vocab-copy', text: i18n().vocabCopy });
      copyBtn.addEventListener('click', async () => {
        await navigator.clipboard.writeText(`${entry.sourceText} → ${entry.targetText}`);
        copyBtn.textContent = i18n().vocabCopied;
        setTimeout(() => { copyBtn.textContent = i18n().vocabCopy; }, 1500);
      });

      if (Array.isArray(entry.pos) && entry.pos.length > 0) {
        const posWrap = card.createEl('div', { cls: 'mtt-vocab-pos-wrap' });
        for (const { pos, terms } of entry.pos) {
          const row = posWrap.createEl('span', { cls: 'mtt-vocab-pos-entry' });
          if (pos) row.createEl('span', { cls: 'mtt-vocab-pos-label', text: pos + ': ' });
          row.appendText((terms || []).join(' / '));
        }
      }
    }
  }
}
*/

// ── Glossary View ────────────────────────────────────────────────────────────
const GLOSSARY_VIEW_TYPE = 'mtt-glossary-view';

class GlossaryView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() { return GLOSSARY_VIEW_TYPE; }
  getDisplayText() { return i18n().glossaryTitle; }
  getIcon() { return 'book-open'; }

  async onOpen() { this.render(); }

  async refresh() {
    await this.plugin.reloadGlossary();
    this.render();
  }

  render() {
    const root = this.containerEl.children[1];
    root.empty();
    root.addClass('mtt-glossary-root');
    const s = i18n();

    const header = root.createEl('div', { cls: 'mtt-glossary-header' });
    header.createEl('span', { cls: 'mtt-glossary-title', text: s.glossaryTitle });
    const reload = header.createEl('button', { cls: 'mtt-glossary-reload', text: '↻', title: s.glossaryReload });
    reload.addEventListener('click', () => void this.refresh());

    const entries = [...this.plugin.glossary.entries]
      .sort((a, b) => b.priority - a.priority || a.source.localeCompare(b.source));
    if (!entries.length) {
      root.createEl('div', { cls: 'mtt-glossary-empty', text: s.glossaryEmpty });
      return;
    }

    const list = root.createEl('div', { cls: 'mtt-glossary-list' });
    for (const entry of entries) {
      const card = list.createEl('article', { cls: 'mtt-glossary-card' });
      card.createEl('div', { cls: 'mtt-glossary-source', text: entry.source });
      card.createEl('div', {
        cls: 'mtt-glossary-meta',
        text: `${languageOptionLabel(entry.sourceLang)} · ${s.glossaryMatch}: ${entry.match}`,
      });

      const targets = Object.entries(entry.targets).filter(([, value]) => typeof value === 'string' && value.trim());
      for (const [language, value] of targets) {
        const row = card.createEl('div', { cls: 'mtt-glossary-target' });
        row.createEl('span', { cls: 'mtt-glossary-target-language', text: languageOptionLabel(language) });
        row.createEl('span', { cls: 'mtt-glossary-target-value', text: value });
      }
      if (entry.aliases.length) {
        card.createEl('div', { cls: 'mtt-glossary-aliases', text: `${s.glossaryAliases}: ${entry.aliases.join(', ')}` });
      }
    }
  }
}

// ── Translation Panel ─────────────────────────────────────────────────────────
const TRANS_VIEW_TYPE = 'mtt-trans-view';

class TranslationView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this._srcLang = plugin.settings.sourceLang;
    this._tgtLang = plugin.settings.targetLang;
    this._result = null;
    this._debounceTimer = null;
    this._inputEl = null;
    this._resultEl = null;
    this._metaEl = null;
    this._copyBtn = null;
    this._srcSelect = null;
    this._tgtSelect = null;
    this._engineSelect = null;
    this._panelEngine = plugin.settings.translationPanelEngine || 'selectionEngine';
  }

  getViewType() { return TRANS_VIEW_TYPE; }
  getDisplayText() { return i18n().transPanelTitle; }
  getIcon() { return 'message-square'; }

  async onOpen() {
    const root = this.containerEl.children[1];
    root.empty();
    root.addClass('mtt-trans-root');
    this._build(root);
  }

  _build(root) {
    const s = i18n();

    // ── Language selector bar ────────────────────────────────────
    const langBar = root.createEl('div', { cls: 'mtt-trans-lang-bar' });

    this._srcSelect = langBar.createEl('select', { cls: 'mtt-trans-lang-select' });
    this._srcSelect.addEventListener('change', () => {
      this._srcLang = this._srcSelect.value;
      this._refreshLanguageSelectors();
      this._scheduleTranslate();
    });

    const swapBtn = langBar.createEl('button', { cls: 'mtt-trans-swap', title: s.transPanelSwap });
    swapBtn.textContent = '⇄';
    swapBtn.addEventListener('click', () => this._swapLangs());

    this._tgtSelect = langBar.createEl('select', { cls: 'mtt-trans-lang-select' });
    this._tgtSelect.addEventListener('change', () => {
      this._tgtLang = this._tgtSelect.value;
      this._refreshLanguageSelectors();
      this._scheduleTranslate();
    });

    this._engineSelect = langBar.createEl('select', {
      cls: 'mtt-trans-lang-select',
      attr: { 'aria-label': s.transPanelEngine, title: s.transPanelEngine },
    });
    this._fillEngineSelect();
    this._engineSelect.addEventListener('change', async () => {
      this._panelEngine = this._engineSelect.value;
      this.plugin.settings.translationPanelEngine = this._panelEngine;
      await this.plugin.saveSettings();
      this._refreshLanguageSelectors();
      this._scheduleTranslate();
    });
    this._refreshLanguageSelectors();

    // ── Source textarea ──────────────────────────────────────────
    const inputWrap = root.createEl('div', { cls: 'mtt-trans-input-wrap' });
    this._inputEl = inputWrap.createEl('textarea', {
      cls: 'mtt-trans-input',
      attr: { placeholder: s.transPanelPlaceholder },
    });
    this._inputEl.addEventListener('input', () => this._scheduleTranslate());

    const clearBtn = inputWrap.createEl('button', {
      cls: 'mtt-trans-clear-btn',
      title: s.transPanelClear,
      text: '✕',
    });
    clearBtn.addEventListener('click', () => {
      this._inputEl.value = '';
      this._result = null;
      this._renderResult();
    });

    // ── Result area ──────────────────────────────────────────────
    this._resultEl = root.createEl('div', { cls: 'mtt-trans-result' });

    // ── Footer ───────────────────────────────────────────────────
    const footer = root.createEl('div', { cls: 'mtt-trans-footer' });
    this._metaEl = footer.createEl('span', { cls: 'mtt-trans-meta' });
    this._copyBtn = footer.createEl('button', { cls: 'mtt-trans-copy', text: s.transPanelCopy });
    this._copyBtn.style.visibility = 'hidden';
    this._copyBtn.addEventListener('click', async () => {
      if (!this._result?.targetText) return;
      await navigator.clipboard.writeText(this._result.targetText);
      this._copyBtn.textContent = s.transPanelCopied;
      setTimeout(() => { this._copyBtn.textContent = s.transPanelCopy; }, 1500);
    });
  }

  _fillLanguageSelect(select, options, value) {
    select.empty ? select.empty() : (select.textContent = '');
    for (const code of options) {
      const opt = select.createEl('option', { text: languageOptionLabel(code) });
      opt.value = code;
    }
    if (!options.includes(value)) {
      const opt = select.createEl('option', { text: unsupportedLanguageOption(value) });
      opt.value = value;
    }
    select.value = value;
  }

  _fillEngineSelect() {
    if (!this._engineSelect) return;
    const s = i18n();
    this._engineSelect.empty ? this._engineSelect.empty() : (this._engineSelect.textContent = '');
    this._engineSelect.createEl('option', { text: s.transPanelEngineSelection, value: 'selectionEngine' });
    for (const key of TRANSLATION_PANEL_ENGINE_KEYS) {
      this._engineSelect.createEl('option', { text: ENGINE_LABELS[key] || key, value: key });
    }
    if (!['selectionEngine', ...TRANSLATION_PANEL_ENGINE_KEYS].includes(this._panelEngine)) {
      this._panelEngine = 'selectionEngine';
      this.plugin.settings.translationPanelEngine = this._panelEngine;
    }
    this._engineSelect.value = this._panelEngine;
  }

  _getEngineKey() {
    return this._panelEngine === 'selectionEngine'
      ? (this.plugin.settings.selectionEngine || 'google')
      : this._panelEngine;
  }

  _refreshLanguageSelectors() {
    if (!this._srcSelect || !this._tgtSelect) return;
    const engine = this._getEngineKey();
    this._fillLanguageSelect(
      this._srcSelect,
      getPairCompatibleLanguageOptions([engine], 'sources', this._tgtLang),
      this._srcLang,
    );
    this._fillLanguageSelect(
      this._tgtSelect,
      getPairCompatibleLanguageOptions([engine], 'targets', this._srcLang),
      this._tgtLang,
    );
  }

  _swapLangs() {
    const prevSrc = this._srcLang;
    const prevTgt = this._tgtLang;
    const newSrc = prevSrc === 'auto' ? (this._result?.sourceLang || prevTgt) : prevTgt;
    const newTgt = prevSrc === 'auto' ? prevTgt : prevSrc;
    this._srcLang = newSrc;
    this._tgtLang = newTgt;
    this._refreshLanguageSelectors();
    if (this._inputEl && this._result?.targetText) {
      this._inputEl.value = this._result.targetText;
    }
    this._scheduleTranslate();
  }

  _scheduleTranslate() {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => this._doTranslate(), 600);
  }

  async _doTranslate() {
    this._debounceTimer = null;
    // Keep whitespace intact so paragraph separators are sent to the engine.
    const text = this._inputEl?.value || '';
    if (!text.trim()) {
      this._result = null;
      this._renderResult();
      return;
    }
    if (this._resultEl) {
      this._resultEl.empty ? this._resultEl.empty() : (this._resultEl.textContent = '');
      this._resultEl.createEl('span', { cls: 'mtt-trans-loading', text: '…' });
    }
    try {
      const engineKey = this._getEngineKey();
      const eng = ENGINES[engineKey] || ENGINES.google;
      this.plugin.assertLanguagePairSupported(engineKey, this._srcLang, this._tgtLang);
      this._result = await this.plugin.translateWithGlossary(text, this._srcLang, this._tgtLang, engineKey);
    } catch (e) {
      this._result = { _error: e.message || String(e) };
    }
    this._renderResult();
  }

  _renderResult() {
    const el = this._resultEl;
    if (!el) return;
    el.empty ? el.empty() : (el.textContent = '');
    const s = i18n();

    if (!this._result) {
      this._metaEl.textContent = '';
      this._copyBtn.style.visibility = 'hidden';
      return;
    }
    if (this._result._error) {
      el.createEl('div', { cls: 'mtt-trans-error', text: `⚠ ${this._result._error}` });
      this._metaEl.textContent = '';
      this._copyBtn.style.visibility = 'hidden';
      return;
    }
    if (!this._result.targetText) {
      el.createEl('div', { cls: 'mtt-trans-empty', text: s.noTranslation });
      this._metaEl.textContent = '';
      this._copyBtn.style.visibility = 'hidden';
      return;
    }

    const { targetText, sourceLang, targetLang, dict, transliteration } = this._result;
    const showDict = Array.isArray(dict) && dict.length > 0;

    if (showDict) {
      const dictWrap = el.createEl('div', { cls: 'mtt-trans-dict' });
      for (const { pos, terms } of dict) {
        const row = dictWrap.createEl('div', { cls: 'mtt-trans-dict-row' });
        if (pos) row.createEl('span', { cls: 'mtt-trans-pos', text: pos + ': ' });
        row.createEl('span', { cls: 'mtt-trans-terms', text: (terms || []).join(' / ') });
      }
    } else {
      el.createEl('div', { cls: 'mtt-trans-target-text', text: targetText });
    }

    if (transliteration) {
      el.createEl('div', { cls: 'mtt-trans-translit', text: transliteration });
    }

    this._metaEl.textContent = sourceLang && targetLang ? `${sourceLang} → ${targetLang}` : '';
    this._copyBtn.style.visibility = '';
  }

  // Called by TooltipManager on hover translation — fills input only when empty.
  update(text, result) {
    if (!this._inputEl || this._inputEl.value.trim()) return;
    this._inputEl.value = text || '';
    this._result = result;
    this._renderResult();
  }
}

// ── Page Translator ───────────────────────────────────────────────────────────
class PageTranslator {
  constructor(plugin) {
    this.plugin = plugin;
    this._cancelled = false;
    this._running = false;
    this._progressEl = null;
    this._observer = null;
    this._translations = new Map();
    this._sessionId = 0;
    this._pendingBlocks = new WeakSet();
    this._translatedFilePath = null;
    this._translatedYamlProperties = null;
    this._translatedNoteSnapshot = null;
    this._translationView = null;
    this._translationSession = null;
  }

  _getViewContainer(view) {
    if (!view) return null;
    if (view.getMode?.() !== 'preview') return null;
    const previewEl = view.previewMode?.containerEl;
    if (!previewEl) return null;
    // This is the public, leaf-specific Reading View root. Do not query a
    // descendant .markdown-rendered element: that can select an embedded note
    // instead of the page the user asked to translate.
    return previewEl;
  }

  // Returns the .markdown-rendered container for the active reading-view leaf,
  // or null when not in reading mode.
  _getContainer(view = this.plugin.app.workspace.activeLeaf?.view) {
    return this._getViewContainer(view);
  }

  // Reflects the current translation state on the header button of a given view.
  _syncButton(view) {
    const btn = view?.containerEl?.querySelector('.mtt-page-btn');
    if (!btn) return;
    const active = !!(this._getViewContainer(view)?.querySelector('[data-mtt-orig]'));
    btn.classList.toggle('is-active', active);
    const engineSelect = view.containerEl.querySelector('.mtt-page-engine-select');
    if (engineSelect) {
      const locked = this._running || active;
      engineSelect.disabled = locked;
      engineSelect.setAttribute('aria-disabled', String(locked));
      engineSelect.classList.toggle('is-disabled', locked);
    }
    const saveBtn = view.containerEl.querySelector('.mtt-page-save-btn');
    if (saveBtn) {
      const canSave = !this._running && view.file?.path === this._translatedFilePath
        && !!this._translatedNoteSnapshot?.content;
      saveBtn.toggleAttribute('disabled', !canSave);
      saveBtn.setAttribute('aria-disabled', String(!canSave));
      saveBtn.classList.toggle('is-disabled', !canSave);
    }
    const dualSaveBtn = view.containerEl.querySelector('.mtt-page-dual-save-btn');
    if (dualSaveBtn) {
      const file = view?.file ?? this.plugin.app.workspace.getActiveFile();
      const canSave = !!(file && !this._running);
      dualSaveBtn.toggleAttribute('disabled', !canSave);
      dualSaveBtn.setAttribute('aria-disabled', String(!canSave));
      dualSaveBtn.classList.toggle('is-disabled', !canSave);
    }
  }

  _isMetadataElement(el) {
    return !!el?.closest?.('.frontmatter,.frontmatter-container,.metadata-property,[data-property-key]');
  }

  // Returns leaf-level translatable block elements (headings, paragraphs, list
  // items, table cells, etc.) that haven't been translated yet.
  _getBlocks(container) {
    const SEL = 'h1,h2,h3,h4,h5,h6,p,li,td,th,figcaption';
    this._wrapNestedListLabels(container);
    const candidates = [
      ...(container.matches?.(SEL) ? [container] : []),
      ...container.querySelectorAll(SEL),
      ...container.querySelectorAll('.mtt-list-label'),
    ];
    return [...new Set(candidates)].filter(el => {
      // Skip content inside code/math/frontmatter
      if (this._isMetadataElement(el)) return false;
      if (el.closest('pre,.math,.math-block,.katex')) return false;
      // Skip already translated
      if (el.hasAttribute('data-mtt-orig')) return false;
      // Only translate leaf-level elements — skip if nested blocks exist inside
      // (prevents double-translating a li > p hierarchy).
      if (!el.classList.contains('mtt-list-label') && el.querySelector('h1,h2,h3,h4,h5,h6,p,li,td,th')) return false;
      return el.textContent.trim().length >= 2;
    });
  }

  // Preserve nested lists while making their direct label text translatable.
  _wrapNestedListLabels(container) {
    const lists = [
      ...(container.matches?.('li') ? [container] : []),
      ...container.querySelectorAll('li'),
    ];
    for (const li of lists) {
      if (li.querySelector(':scope > .mtt-list-label')) continue;
      const nested = [...li.children].find(child => child.matches('ul,ol'));
      if (!nested) continue;
      const nodes = [];
      for (const node of [...li.childNodes]) {
        if (node === nested) break;
        if (node.nodeType === Node.ELEMENT_NODE && node.matches('input.task-list-item-checkbox')) continue;
        nodes.push(node);
      }
      // A paragraph/heading child is already selected as its own leaf block.
      if (nodes.some(node => node.nodeType === Node.ELEMENT_NODE
        && node.matches('h1,h2,h3,h4,h5,h6,p,li,td,th'))) continue;
      if (!nodes.some(node => (node.textContent || '').trim().length >= 2)) continue;
      const span = document.createElement('span');
      span.className = 'mtt-list-label';
      li.insertBefore(span, nodes[0]);
      nodes.forEach(node => span.appendChild(node));
    }
  }

  _unwrapListLabels(container) {
    container.querySelectorAll('.mtt-list-label').forEach(span => span.replaceWith(...span.childNodes));
  }

  _splitText(text, maxLength = 1800) {
    if (text.length <= maxLength) return [text];
    const parts = text.match(/[^.!?。！？\n]+[.!?。！？\n]*|.+$/gu) || [text];
    const chunks = [];
    let current = '';
    for (const part of parts) {
      if (part.length > maxLength) {
        if (current.trim()) chunks.push(current.trim());
        current = '';
        for (let i = 0; i < part.length; i += maxLength) chunks.push(part.slice(i, i + maxLength).trim());
      } else if (current.length + part.length > maxLength) {
        if (current.trim()) chunks.push(current.trim());
        current = part;
      } else {
        current += part;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.filter(Boolean);
  }

  async _translateWithRetry(
    text, eng, engine, sourceLang, targetLang, disableCache, tooltip, requireChanged = false
  ) {
    this.plugin.assertLanguagePairSupported(engine, sourceLang, targetLang);
    const translated = [];
    // Keep page translation aligned with selection translation. Local and
    // compatible LLM servers often return only the start of a large response,
    // which made a long page block look as though only its first chunk worked.
    const maxLength = LLM_ENGINE_KEYS.has(engine) ? 700 : 1800;
    const chunks = this._splitText(text, maxLength);
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      const key = `v3|${this.plugin.glossary.cacheKey()}|${engine}|${sourceLang}|${targetLang}|${chunk}`;
      const isUnchanged = (value) => !!value && this._sameTranslationText(value, chunk);
      let cached = disableCache ? null : tooltip?.cacheGet(key);
      // Never reuse an unchanged response when a bilingual export needs a
      // genuine target paragraph.
      if (requireChanged && isUnchanged(cached?.targetText)) cached = null;
      let result = cached;
      for (let attempt = 0;
        (!result?.targetText || (requireChanged && isUnchanged(result.targetText))) && attempt < 3;
        attempt++) {
        if (this._cancelled) return { ok: false, cancelled: true };
        if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 350 * (2 ** (attempt - 1))));
        result = await this.plugin.translateWithGlossary(chunk, sourceLang, targetLang, engine);
      }
      if (!result?.targetText || (requireChanged && isUnchanged(result.targetText))) {
        return { ok: false, unchanged: !!result?.targetText };
      }
      // Do not retain echo/no-op responses as translations. A stale unchanged
      // cache entry previously made every later bilingual retry repeat source.
      if (!cached && !isUnchanged(result.targetText)) {
        tooltip?.cacheSet(key, result, chunk);
      }
      // The same-language filter belongs to tooltip display only. A page or
      // bilingual export must retain the engine's returned target text, even
      // when automatic language detection reports the target language.
      translated.push(result.targetText);
      if (!cached && chunkIndex < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 160));
      }
    }
    const targetText = translated.join(' ').replace(/ \n/g, '\n').trim();
    return { ok: true, targetText, changed: !!targetText && !this._sameTranslationText(targetText, text) };
  }

  _observeRerenders(view, onRenderedBlocks) {
    this._observer?.disconnect();
    // Observe the stable preview root, not .markdown-rendered itself. Obsidian
    // can replace the latter while asynchronous page translation is running.
    const root = view?.previewMode?.containerEl ?? view?.containerEl;
    if (!root) return;
    const sessionId = this._sessionId;
    this._observer = new MutationObserver(records => {
      if (sessionId !== this._sessionId) return;
      if (!records.some(record => record.addedNodes.length || record.removedNodes.length)) return;
      const container = this._getViewContainer(view);
      if (!container) return;
      this._applyManifestToContainer(container);
      onRenderedBlocks?.(container);
      this._syncButton(view);
    });
    this._observer.observe(root, { childList: true, subtree: true });
  }

  _stopObserving() {
    this._observer?.disconnect();
    this._observer = null;
    this._sessionId++;
  }

  _showProgress(current, total) {
    if (!this._progressEl) {
      const el = document.createElement('div');
      el.className = 'mtt-page-progress';
      el.innerHTML = `<span class="mtt-page-progress-label"></span>` +
        `<div class="mtt-page-progress-bar-wrap"><div class="mtt-page-progress-bar"></div></div>` +
        `<button class="mtt-page-progress-cancel" aria-label="${i18n().pageCancel}">✕</button>`;
      el.querySelector('.mtt-page-progress-cancel').onclick = () => this.cancel();
      document.body.appendChild(el);
      this._progressEl = el;
      this._repositionProgress();
    }
    const pct = total > 0 ? Math.round(current / total * 100) : 0;
    this._progressEl.querySelector('.mtt-page-progress-label').textContent =
      i18n().pageTranslating(current, total);
    this._progressEl.querySelector('.mtt-page-progress-bar').style.width = `${pct}%`;
  }

  _repositionProgress() {
    if (!this._progressEl) return;
    const view = this.plugin.app.workspace.activeLeaf?.view;
    const headerEl = view?.containerEl?.querySelector('.view-header');
    if (headerEl) {
      const rect = headerEl.getBoundingClientRect();
      Object.assign(this._progressEl.style, {
        top: `${rect.bottom - 26}px`,
        left: `${rect.left + 8}px`,
        bottom: 'auto',
        transform: 'none',
      });
    }
  }

  _hideProgress() {
    if (this._progressEl) { this._progressEl.remove(); this._progressEl = null; }
  }

  cancel() {
    this._cancelled = true;
    this._running = false;
    this._hideProgress();
    this._stopObserving();
    this._translations.clear();
    this._translatedFilePath = null;
    this._translatedYamlProperties = null;
    this._translatedNoteSnapshot = null;
    this._translationSession = null;
    // Revert any blocks that were translated before cancellation
    const view = this._translationView ?? this.plugin.app.workspace.activeLeaf?.view;
    const container = this._getContainer(view);
    if (container) {
      container.querySelectorAll('[data-mtt-orig]').forEach(el => {
        el.innerHTML = el.getAttribute('data-mtt-orig');
        el.removeAttribute('data-mtt-orig');
        el.removeAttribute('data-mtt-target');
        el.classList.remove('mtt-page-translated');
      });
      this._unwrapListLabels(container);
    }
    this._syncButton(view);
    this._translationView = null;
  }

  hasTranslation(view = this.plugin.app.workspace.activeLeaf?.view) {
    const container = this._getContainer(view);
    return !!(container && container.querySelector('[data-mtt-orig]'));
  }

  canSaveTranslation(file) {
    return !!(file && !this._running && file.path === this._translatedFilePath
      && this._translatedNoteSnapshot?.content);
  }

  // A dual-language save can prepare its own page-translation session. Once a
  // page is already translated, only the completed session is valid to avoid
  // mixing a partial/failed translation into the saved note.
  canStartDualLanguageSave(view = this.plugin.app.workspace.activeLeaf?.view) {
    const file = view?.file ?? this.plugin.app.workspace.getActiveFile();
    return !!(file && !this._running);
  }

  getTranslatedNoteSnapshot(file) {
    return file?.path === this._translatedFilePath ? this._translatedNoteSnapshot : null;
  }

  // Convert the translated Reading View to portable Markdown. Translation replaces
  // rendered block text, so inline formatting is intentionally stored as plain text.
  getTranslatedMarkdown() {
    const container = this._getContainer();
    if (!container) return '';
    const clean = (text) => (text || '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    const blocks = container.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,pre,blockquote,table,hr,figcaption');
    const lines = [];
    for (const el of blocks) {
      if (this._isMetadataElement(el)) continue;
      if (el.closest('pre,.math,.math-block,.katex') && el.tagName !== 'PRE') continue;
      if (el.tagName === 'P' && el.closest('li,blockquote,table')) continue;
      if (el.tagName === 'LI') {
        const copy = el.cloneNode(true);
        copy.querySelectorAll('ul,ol').forEach(list => list.remove());
        const text = clean(copy.textContent);
        if (!text) continue;
        let depth = -1;
        for (let parent = el.parentElement; parent; parent = parent.parentElement) {
          if (parent.matches('ul,ol')) depth++;
        }
        depth = Math.max(0, depth);
        const marker = el.parentElement?.tagName === 'OL' ? '1.' : '-';
        lines.push(`${'  '.repeat(depth)}${marker} ${text}`);
        continue;
      }
      if (el.tagName === 'TABLE') {
        const rows = [...el.querySelectorAll('tr')].map(row => [...row.querySelectorAll('th,td')]
          .map(cell => clean(cell.textContent).replace(/\|/g, '\\|')));
        if (rows.length) {
          lines.push(`| ${rows[0].join(' | ')} |`);
          lines.push(`| ${rows[0].map(() => '---').join(' | ')} |`);
          rows.slice(1).forEach(row => lines.push(`| ${row.join(' | ')} |`));
        }
        continue;
      }
      const text = clean(el.textContent);
      if (!text) continue;
      if (/^H[1-6]$/.test(el.tagName)) lines.push(`${'#'.repeat(Number(el.tagName.slice(1)))} ${text}`);
      else if (el.tagName === 'PRE') lines.push(`\`\`\`\n${text}\n\`\`\``);
      else if (el.tagName === 'BLOCKQUOTE') lines.push(text.split('\n').map(line => `> ${line}`).join('\n'));
      else if (el.tagName === 'HR') lines.push('---');
      else lines.push(text);
    }
    return lines.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  async getDualLanguageMarkdown(view = this.plugin.app.workspace.activeLeaf?.view) {
    const file = view?.file ?? this.plugin.app.workspace.getActiveFile();
    if (!file) return '';
    try {
      const snapshot = await this.createDualLanguageNoteSnapshot(file, view);
      return snapshot?.content || '';
    } catch (e) {
      console.warn('[mtt] Failed to get dual language markdown:', e);
      return '';
    }
  }

  _translationKey(text) {
    return (text || '')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/(\*\*|__|~~|==)(.*?)\1/g, '$2')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
      .replace(/(?<!_)_([^_]+)_(?!_)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _sameTranslationText(left, right) {
    return this._translationKey(left) === this._translationKey(right);
  }

  // Obsidian can reuse a marked DOM node while restoring its source content.
  // In that case an old data-mtt-target attribute may also contain the source
  // text. Treat that as invalid and prefer the session map, whose values come
  // directly from the translation response.
  _getStoredTargetText(el, originalText) {
    const clean = (value) => (value || '')
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    const mappedTarget = clean(this._translations.get(this._translationKey(originalText)));
    if (mappedTarget && !this._sameTranslationText(mappedTarget, originalText)) {
      return mappedTarget;
    }
    const attributeTarget = clean(el?.getAttribute?.('data-mtt-target'));
    if (attributeTarget && !this._sameTranslationText(attributeTarget, originalText)) {
      return attributeTarget;
    }
    return '';
  }

  _splitSourceNote(source) {
    const match = source.match(/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
    if (!match) return { yaml: null, body: source };
    return { yaml: match[1], body: source.slice(match[0].length) };
  }

  _getTranslationEngineMetadata(engine) {
    const providerLabels = {
      localLlm: 'OpenAI Compatible API',
      ollama: 'Ollama',
      lmstudio: 'LM Studio',
    };
    const modelSettings = {
      localLlm: 'llmModel',
      ollama: 'ollamaModel',
      lmstudio: 'lmstudioModel',
    };
    const modelSetting = modelSettings[engine];
    return {
      provider: providerLabels[engine] || ENGINE_LABELS[engine] || engine,
      model: modelSetting ? String(this.plugin.settings[modelSetting] || '').trim() : null,
    };
  }

  _addTranslationMetadata(properties, engine) {
    const metadata = this._getTranslationEngineMetadata(engine);
    const next = { ...(properties && typeof properties === 'object' ? properties : {}) };
    next.translationengine = metadata.provider;
    if (metadata.model !== null) next.translationmodel = metadata.model;
    else delete next.translationmodel;
    return next;
  }

  _parseMarkdownUnits(body) {
    const lines = body.split(/\r?\n/);
    const units = [];
    let inFence = false;
    const isSpecial = (line) => /^\s*(?:```|~~~|\|.*\||---+|\*\*\*+|___+|!\[\[|<[^>]+>|>\s*\[!)/.test(line);
    for (let i = 0; i < lines.length;) {
      const line = lines[i];
      if (/^\s*(?:```|~~~)/.test(line)) { inFence = !inFence; i++; continue; }
      if (inFence || !line.trim() || isSpecial(line)) { i++; continue; }
      const marker = line.match(/^(\s*(?:#{1,6}\s+|(?:[-+*]|\d+[.)])\s+(?:\[[ xX]\]\s+)?|>\s+(?!\[!)))(.+)$/);
      if (marker) {
        const text = marker[2].trim();
        if (text.length >= 2) units.push({ start: i, end: i + 1, text, render: (target) => `${marker[1]}${target}` });
        i++;
        continue;
      }
      const start = i;
      const paragraph = [];
      while (i < lines.length && lines[i].trim() && !isSpecial(lines[i])
        && !/^\s*(?:#{1,6}\s+|(?:[-+*]|\d+[.)])\s+|>\s+)/.test(lines[i])) {
        paragraph.push(lines[i]);
        i++;
      }
      const text = paragraph.join('\n').trim();
      if (text.length >= 2) units.push({ start, end: i, text, render: (target) => target });
      // Always advance past an unsupported structural line. Previously a
      // callout-like line that matched neither branch left i unchanged and
      // prevented the rest of the note from reaching the bilingual renderer.
      if (i === start) i++;
    }
    return { lines, units };
  }

  _renderTranslatedBody(parsed) {
    const lines = [...parsed.lines];
    for (const unit of [...parsed.units].sort((a, b) => b.start - a.start)) {
      if (unit.targetText == null) continue;
      lines.splice(unit.start, unit.end - unit.start, unit.render(unit.targetText));
    }
    return lines.join('\n').trim() + '\n';
  }

  _parseMarkdownBlocks(body) {
    const lines = (body || '').replace(/\r\n/g, '\n').split('\n');
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Blank lines
      if (!line.trim()) {
        blocks.push({ type: 'empty', raw: line });
        i++;
        continue;
      }

      // Fenced Code Block: ``` or ~~~
      const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
      if (fenceMatch) {
        const fence = fenceMatch[2];
        const codeLines = [line];
        i++;
        while (i < lines.length) {
          codeLines.push(lines[i]);
          if (lines[i].trim().startsWith(fence)) {
            i++;
            break;
          }
          i++;
        }
        blocks.push({ type: 'code', raw: codeLines.join('\n') });
        continue;
      }

      // Math Block: $$ ... $$
      if (line.trim().startsWith('$$')) {
        const mathLines = [line];
        i++;
        if (!line.trim().slice(2).includes('$$')) {
          while (i < lines.length) {
            mathLines.push(lines[i]);
            if (lines[i].trim().includes('$$')) {
              i++;
              break;
            }
            i++;
          }
        }
        blocks.push({ type: 'math', raw: mathLines.join('\n') });
        continue;
      }

      // HTML comments <!-- ... -->
      if (line.trim().startsWith('<!--')) {
        const commentLines = [line];
        i++;
        if (!line.includes('-->')) {
          while (i < lines.length) {
            commentLines.push(lines[i]);
            if (lines[i].includes('-->')) {
              i++;
              break;
            }
            i++;
          }
        }
        blocks.push({ type: 'comment', raw: commentLines.join('\n') });
        continue;
      }

      // Horizontal Rule: ---, ***, ___
      if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        blocks.push({ type: 'hr', raw: line });
        i++;
        continue;
      }

      // Standalone embed: ![[...]] or ![...](...)
      if (/^\s*!(?:\[\[[\s\S]*?\]\]|\[.*?\]\(.*?\))\s*$/.test(line)) {
        blocks.push({ type: 'embed', raw: line });
        i++;
        continue;
      }

      // Table
      if (/^\s*\|.*\|\s*$/.test(line)) {
        const tableLines = [line];
        i++;
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
          tableLines.push(lines[i]);
          i++;
        }
        blocks.push({ type: 'table', raw: tableLines.join('\n'), lines: tableLines });
        continue;
      }

      // Headings: # Heading
      const headingMatch = line.match(/^(\s*#{1,6}\s+)(.+)$/);
      if (headingMatch) {
        blocks.push({
          type: 'heading',
          prefix: headingMatch[1],
          text: headingMatch[2].trim(),
          raw: line,
        });
        i++;
        continue;
      }

      // Callout header: > [!NOTE] Optional title
      const calloutMatch = line.match(/^(\s*>\s*\[!([A-Za-z0-9_-]+)\][+-]?\s*)(.*)$/);
      if (calloutMatch) {
        blocks.push({
          type: 'callout_header',
          prefix: calloutMatch[1],
          calloutType: calloutMatch[2],
          text: calloutMatch[3].trim(),
          raw: line,
        });
        i++;
        continue;
      }

      // Blockquote line: > text
      const quoteMatch = line.match(/^(\s*>\s*)(.+)$/);
      if (quoteMatch) {
        blocks.push({
          type: 'quote',
          prefix: quoteMatch[1],
          text: quoteMatch[2].trim(),
          raw: line,
        });
        i++;
        continue;
      }

      // List item: - item, * item, 1. item, - [ ] item
      const listMatch = line.match(/^(\s*(?:[-+*]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)(.+)$/);
      if (listMatch) {
        blocks.push({
          type: 'list',
          prefix: listMatch[1],
          text: listMatch[2].trim(),
          raw: line,
        });
        i++;
        continue;
      }

      // Footnote definition: [^1]: Text
      const footnoteMatch = line.match(/^(\s*\[\^[^\]]+\]:\s*)(.+)$/);
      if (footnoteMatch) {
        blocks.push({
          type: 'footnote',
          prefix: footnoteMatch[1],
          text: footnoteMatch[2].trim(),
          raw: line,
        });
        i++;
        continue;
      }

      // Standard Paragraph: collect contiguous lines until blank line or special block
      const pLines = [line];
      i++;
      while (i < lines.length) {
        const nextLine = lines[i];
        if (!nextLine.trim()) break;
        if (/^\s*(?:`{3,}|~{3,}|\$\$|<!--|-{3,}|\*{3,}|_{3,}|!\[\[|!\[|\|.*\||#{1,6}\s+|(?:[-+*]|\d+[.)])\s+|>\s*|\[\^[^\]]+\]:\s*)/.test(nextLine)) {
          break;
        }
        pLines.push(nextLine);
        i++;
      }
      blocks.push({
        type: 'paragraph',
        text: pLines.join('\n').trim(),
        raw: pLines.join('\n'),
      });
    }

    return blocks;
  }

  _renderDualLanguageBody(blocks) {
    const resultLines = [];
    for (const block of blocks) {
      if (block.type === 'empty' || block.type === 'code' || block.type === 'math' ||
          block.type === 'comment' || block.type === 'hr' || block.type === 'embed' || block.type === 'table') {
        resultLines.push(block.raw);
        continue;
      }

      const sourceText = block.text?.trim() || '';
      const targetText = block.targetText?.trim() || '';

      if (!targetText || this._sameTranslationText(targetText, sourceText)) {
        resultLines.push(block.raw);
        continue;
      }

      if (block.type === 'paragraph') {
        resultLines.push(block.raw);
        resultLines.push(targetText);
      } else if (block.type === 'heading' || block.type === 'list' || block.type === 'quote' || block.type === 'footnote') {
        resultLines.push(block.raw);
        resultLines.push(`${block.prefix}${targetText}`);
      } else if (block.type === 'callout_header') {
        resultLines.push(block.raw);
        if (block.text) {
          resultLines.push(`${block.prefix}${targetText}`);
        }
      }
    }
    return resultLines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  _applyKnownTranslation(el) {
    if (el.hasAttribute('data-mtt-orig')) {
      const originalText = getOriginalText(el);
      const targetText = this._translations.get(this._translationKey(originalText));
      if (targetText) {
        el.setAttribute('data-mtt-target', targetText);
      }
      if (originalText && targetText && !this._sameTranslationText(targetText, originalText)) {
        // Preserve both sides of the same pair used by hover. If Obsidian
        // reused this node and restored its source text, reapply the target.
        if (el.textContent.trim() === originalText.trim()) el.textContent = targetText;
      }
      return false;
    }
    const originalText = el.textContent.trim();
    const targetText = this._translations.get(this._translationKey(originalText));
    if (!targetText) return false;
    el.setAttribute('data-mtt-orig', el.innerHTML);
    el.setAttribute('data-mtt-target', targetText);
    if (!this._sameTranslationText(targetText, originalText)) {
      el.textContent = targetText;
      el.classList.add('mtt-page-translated');
      return true;
    }
    return false;
  }

  _applyManifestToContainer(container) {
    let applied = 0;
    // _getBlocks() intentionally excludes already marked elements, so repair
    // those first in a dedicated pass. Obsidian sometimes restores source
    // text on a reused node without removing our data attributes.
    for (const el of container.querySelectorAll('[data-mtt-orig]')) {
      const originalText = getOriginalText(el);
      const targetText = this._getStoredTargetText(el, originalText);
      if (targetText) {
        el.setAttribute('data-mtt-target', targetText);
      }
      if (!originalText || !targetText || this._sameTranslationText(targetText, originalText)) continue;
      if (this._sameTranslationText(el.textContent, originalText)) {
        el.textContent = targetText;
        el.classList.add('mtt-page-translated');
        applied++;
      }
    }
    for (const el of this._getBlocks(container)) {
      if (this._applyKnownTranslation(el)) applied++;
    }
    return applied;
  }

  // Add every currently rendered, untranslated leaf block to the live page
  // queue. Obsidian can replace or lazily add Reading View nodes while a page
  // translation request is in flight, so a one-time DOM snapshot is not enough.
  _enqueueUntranslatedBlocks(container, queue, completedKeys, queuedKeys) {
    if (!container) return 0;
    this._applyManifestToContainer(container);
    let added = 0;
    for (const el of this._getBlocks(container)) {
      if (this._pendingBlocks.has(el)) continue;
      const originalText = el.textContent.trim();
      const key = this._translationKey(originalText);
      if (!key || completedKeys.has(key) || queuedKeys.has(key) || this._translations.has(key)) continue;
      this._pendingBlocks.add(el);
      queuedKeys.add(key);
      queue.push({ el, key, originalText });
      added++;
    }
    return added;
  }

  async createTranslatedNoteSnapshot(file, sourceNote, translatedBody) {
    if (!translatedBody.trim()) throw new Error('No translated page content to save');

    const engine = this._translationSession?.pageEngine || this.plugin.getPageTranslationEngine();
    let properties = sourceNote.yaml === null ? {} : null;
    if (sourceNote.yaml !== null) {
      properties = this.plugin.settings.translateYamlPropertyValues
        ? this._translatedYamlProperties
        : parseYaml(sourceNote.yaml);
      if (this.plugin.settings.translateYamlPropertyValues && properties === null) {
        throw new Error('Translated YAML properties are unavailable');
      }
    }
    const yaml = stringifyYaml(this._addTranslationMetadata(properties, engine)).trimEnd();
    const content = `---\n${yaml}${yaml ? '\n' : ''}---\n\n${translatedBody.trimStart()}`;

    const title = await this.getTranslatedNoteTitle(file.basename);
    if (!title) throw new Error('No translated note title');
    return { content, title };
  }

  async createDualLanguageNoteSnapshot(file, view = this.plugin.app.workspace.activeLeaf?.view) {
    const source = await this.plugin.app.vault.cachedRead(file);
    const sourceNote = this._splitSourceNote(source);
    const { sourceLang, targetLang, disableCache } = this._translationSession ?? this.plugin.settings;
    const engine = this._translationSession?.pageEngine || this.plugin.getPageTranslationEngine();

    let properties = sourceNote.yaml === null ? {} : null;
    if (sourceNote.yaml !== null) {
      if (this.plugin.settings.translateYamlPropertyValues) {
        try {
          const parsedYaml = parseYaml(sourceNote.yaml) ?? {};
          properties = await this.translateYamlProperties(parsedYaml);
        } catch (e) {
          console.warn('[mtt] YAML property translation error:', e);
        }
      }
      if (properties === null) properties = parseYaml(sourceNote.yaml) ?? {};
    }
    const finalYaml = stringifyYaml(this._addTranslationMetadata(properties, engine)).trimEnd();
    const yamlPart = `---\n${finalYaml}${finalYaml ? '\n' : ''}---\n\n`;

    const blocks = this._parseMarkdownBlocks(sourceNote.body);
    const eng = ENGINES[engine] || ENGINES.google;
    this.plugin.assertLanguagePairSupported(engine, sourceLang, targetLang);

    // Identify translatable blocks
    const translatableBlocks = blocks.filter(b =>
      (b.type === 'heading' || b.type === 'paragraph' || b.type === 'list' || b.type === 'quote' || b.type === 'callout_header' || b.type === 'footnote')
      && b.text && b.text.trim().length >= 2
    );

    let progressTotal = translatableBlocks.length;
    let progressCurrent = 0;
    const showProgress = progressTotal > 8;

    for (const block of translatableBlocks) {
      const sourceText = block.text.trim();
      const key = this._translationKey(sourceText);
      let targetText = this._translations.get(key) || this._translations.get(sourceText);

      if (!targetText || this._sameTranslationText(targetText, sourceText)) {
        try {
          const outcome = await this._translateWithRetry(
            sourceText, eng, engine, sourceLang, targetLang, disableCache, this.plugin.tooltip, false
          );
          if (outcome?.ok && outcome.targetText) {
            targetText = outcome.targetText.trim();
            if (!this._sameTranslationText(targetText, sourceText)) {
              this._translations.set(key, targetText);
            }
          }
        } catch (e) {
          console.warn('[mtt] Error translating block for dual language note:', e);
        }
        if (showProgress) {
          progressCurrent++;
          if (progressCurrent % 4 === 0 || progressCurrent === progressTotal) {
            this._showProgress(progressCurrent, progressTotal);
          }
        }
        await new Promise(resolve => setTimeout(resolve, 80));
      } else {
        if (showProgress) {
          progressCurrent++;
        }
      }
      block.targetText = targetText || sourceText;
    }
    if (showProgress) {
      this._hideProgress();
    }

    const dualBody = this._renderDualLanguageBody(blocks);
    if (!dualBody.trim()) throw new Error('No dual language content to save');
    const content = `${yamlPart}${dualBody.trimStart()}`;
    const title = this._translatedNoteSnapshot?.title
      || await this.getTranslatedNoteTitle(file.basename);
    if (!title) throw new Error('No translated note title');
    return { content, title };
  }

  async getTranslatedNoteTitle(basename) {
    const codePattern = /^\s*[A-Za-z]+\d+(?:[._-]\d+)*[\s:：\-–—]*/;
    const titleOnly = basename.replace(codePattern, '').trim() || basename.trim();
    let translatedTitle = this._translations.get(this._translationKey(titleOnly))
      || this._translations.get(this._translationKey(basename));

    if (!translatedTitle) {
      const heading = this._getContainer()?.querySelector('h1[data-mtt-orig],h2[data-mtt-orig]');
      const headingOriginal = heading ? getOriginalText(heading) : '';
      if (heading && (headingOriginal === basename || headingOriginal === titleOnly)) {
        translatedTitle = heading.textContent.trim();
      }
    }

    if (!translatedTitle) {
      const { sourceLang, targetLang, disableCache } = this._translationSession ?? this.plugin.settings;
      const engine = this._translationSession?.pageEngine || this.plugin.getPageTranslationEngine();
      const eng = ENGINES[engine] || ENGINES.google;
      const outcome = await this._translateWithRetry(
        titleOnly, eng, engine, sourceLang, targetLang, disableCache, this.plugin.tooltip
      );
      if (outcome?.ok && outcome.changed) translatedTitle = outcome.targetText;
    }

    return (translatedTitle || '')
      .replace(codePattern, '')
      .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _shouldTranslateYamlValue(text, key) {
    const value = text.trim();
    if (!value || !/[\p{L}]/u.test(value)) return false;
    const machineKey = /^(?:tags?|cssclasses?|id|uid|uuid|url|uri|link|path|file|created|modified|updated|dates?|times?|permalink)$/i;
    if (machineKey.test(key || '')) return false;
    if (/^(?:https?:\/\/|mailto:|obsidian:|file:|ftp:)/i.test(value)) return false;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return false;
    if (/^\[\[[\s\S]*\]\]$/.test(value) || /^!\[\[[\s\S]*\]\]$/.test(value)) return false;
    if (/^\d{4}-\d{1,2}-\d{1,2}(?:[T ][\d:.+-]+Z?)?$/.test(value)) return false;
    if (/^(?:#[\p{L}\p{N}_/-]+|[A-Za-z]:[\\/]|\.{0,2}[\\/])/u.test(value)) return false;
    return true;
  }

  async translateYamlProperties(value, key = '') {
    if (typeof value === 'string') {
      if (!this._shouldTranslateYamlValue(value, key)) return value;
      const { sourceLang, targetLang, disableCache } = this._translationSession ?? this.plugin.settings;
      const engine = this._translationSession?.pageEngine || this.plugin.getPageTranslationEngine();
      const eng = ENGINES[engine] || ENGINES.google;
      const outcome = await this._translateWithRetry(
        value, eng, engine, sourceLang, targetLang, disableCache, this.plugin.tooltip
      );
      if (!outcome?.ok) throw new Error(`Failed to translate YAML property: ${key || '(list item)'}`);
      await new Promise(resolve => setTimeout(resolve, 120));
      return outcome.changed ? outcome.targetText : value;
    }
    if (Array.isArray(value)) {
      const result = [];
      for (const item of value) result.push(await this.translateYamlProperties(item, key));
      return result;
    }
    if (value && Object.prototype.toString.call(value) === '[object Object]') {
      const result = {};
      for (const [childKey, childValue] of Object.entries(value)) {
        result[childKey] = await this.translateYamlProperties(childValue, childKey);
      }
      return result;
    }
    return value;
  }

  async translatePage(view = this.plugin.app.workspace.activeLeaf?.view) {
    if (this._running) {
      new Notice(i18n().pageAlreadyRunning);
      return;
    }
    const container = this._getViewContainer(view);
    if (!container) {
      new Notice(i18n().pageNeedReadingView);
      return;
    }
    // Translate the rendered leaf blocks directly. The rendered text is the
    // only reliable source for updating Reading View because raw Markdown and
    // its rendered DOM can differ (tables, callouts, embeds, inline markup).
    if (this._getBlocks(container).length === 0) {
      new Notice(i18n().pageNoText);
      return;
    }
    const sourceFile = view?.file ?? this.plugin.app.workspace.getActiveFile();
    let sourceNote = null;
    let parsed = { lines: [], units: [] };
    if (sourceFile) {
      try {
        sourceNote = this._splitSourceNote(await this.plugin.app.vault.cachedRead(sourceFile));
        parsed = this._parseMarkdownUnits(sourceNote.body);
      } catch (e) {
        // Reading the source note is only needed to offer a saveable snapshot.
        // Do not let it prevent the visible Reading View from being translated.
        console.warn('[mtt] Failed to read source note for translated snapshot:', e);
      }
    }
    const yamlTask = !!sourceNote && this.plugin.settings.translateYamlPropertyValues && sourceNote.yaml !== null;
    this._stopObserving();
    this._running = true;
    this._translationView = view;
    this._cancelled = false;
    this._translations.clear();
    this._pendingBlocks = new WeakSet();
    this._translatedFilePath = null;
    this._translatedYamlProperties = null;
    this._translatedNoteSnapshot = null;
    this._syncButton(view);

    const { sourceLang, targetLang, disableCache } = this.plugin.settings;
    const engine = this.plugin.getPageTranslationEngine();
    const eng = ENGINES[engine] || ENGINES.google;
    this._translationSession = { pageEngine: engine, sourceLang, targetLang, disableCache };
    try {
      this.plugin.assertLanguagePairSupported(engine, sourceLang, targetLang);
    } catch (e) {
      this._running = false;
      this._syncButton(view);
      new Notice(e.message || String(e));
      return;
    }
    const tooltip = this.plugin.tooltip;
    let yamlProperties = null;
    let yamlPreparationError = null;
    if (yamlTask) {
      try {
        yamlProperties = parseYaml(sourceNote.yaml) ?? {};
      } catch (e) {
        yamlPreparationError = e;
      }
    }

    const blockQueue = [];
    const completedKeys = new Set();
    const queuedKeys = new Set();
    let total = yamlTask ? 1 : 0;
    let attempted = 0;
    let successful = 0;
    let failed = 0;
    const queueRenderedBlocks = (renderedContainer) => {
      const added = this._enqueueUntranslatedBlocks(
        renderedContainer, blockQueue, completedKeys, queuedKeys
      );
      if (added) {
        total += added;
        this._showProgress(attempted, total);
      }
      return added;
    };
    const queueSourceUnits = () => {
      let added = 0;
      for (const unit of parsed.units) {
        // Use the same plain-text identity as Reading View. Sending raw
        // Markdown here could otherwise put literal **, links, or backticks
        // into the visible translated page.
        const originalText = this._translationKey(unit.text);
        const key = originalText;
        if (!key || completedKeys.has(key) || queuedKeys.has(key) || this._translations.has(key)) continue;
        queuedKeys.add(key);
        blockQueue.push({ key, originalText });
        added++;
      }
      if (added) {
        total += added;
        this._showProgress(attempted, total);
      }
      return added;
    };

    // First read regular Markdown units from the note source, then supplement
    // them with rendered-only structures such as tables and callouts. Start
    // observing before any asynchronous request so late Reading View blocks
    // join the same operation instead of requiring a second command.
    queueSourceUnits();
    queueRenderedBlocks(container);
    this._showProgress(0, total);
    this._observeRerenders(view, (renderedContainer) => {
      if (this._running && !this._cancelled) queueRenderedBlocks(renderedContainer);
    });

    if (yamlTask) {
      try {
        if (yamlPreparationError) throw yamlPreparationError;
        this._translatedYamlProperties = await this.translateYamlProperties(yamlProperties);
        if (!this._cancelled) {
          successful++;
        }
      } catch (e) {
        if (!this._cancelled) {
          console.warn('[mtt] YAML property translation error:', e);
          failed++;
        }
      }
      attempted++;
      this._showProgress(attempted, total);
    }

    // The unauthenticated web engines and small local LLM servers commonly
    // accept the first page request then throttle concurrent follow-ups.
    // Process the live queue in order, then wait for Reading View to settle
    // before declaring the note complete.
    let quietRounds = 0;
    while (!this._cancelled) {
      const task = blockQueue.shift();
      if (!task) {
        if (quietRounds >= 3) break;
        await new Promise(resolve => setTimeout(resolve, 300));
        if (!this._cancelled) {
          const currentContainer = this._getViewContainer(view);
          const added = queueRenderedBlocks(currentContainer);
          quietRounds = added ? 0 : quietRounds + 1;
        }
        continue;
      }

      quietRounds = 0;
      const { key, originalText } = task;
      try {
        const outcome = await this._translateWithRetry(
          originalText, eng, engine, sourceLang, targetLang, disableCache, tooltip
        );
        if (outcome.ok) {
          this._translations.set(key, outcome.targetText);
          if (outcome.changed) {
            successful++;
            const currentContainer = this._getViewContainer(view);
            if (currentContainer) this._applyManifestToContainer(currentContainer);
          }
        } else if (!outcome.cancelled) {
          failed++;
        }
      } catch (e) {
        console.warn('[mtt] page translation error:', e);
        failed++;
      } finally {
        queuedKeys.delete(key);
        completedKeys.add(key);
      }
      attempted++;
      this._showProgress(attempted, total);
      if (!this._cancelled) await new Promise(resolve => setTimeout(resolve, 160));
    }

    this._hideProgress();

    if (!this._cancelled) {
      const currentContainer = this._getViewContainer(view);
      if (currentContainer) this._applyManifestToContainer(currentContainer);
      this._observeRerenders(view);
      if (failed === 0 && sourceFile && sourceNote) {
        try {
          // Reuse direct block results for simple Markdown units when making a
          // saveable snapshot. A mismatch here must never prevent visual page
          // translation, which has already been applied above.
          for (const unit of parsed.units) {
            unit.targetText = this._translations.get(this._translationKey(unit.text));
          }
          const translatedBody = this._renderTranslatedBody(parsed);
          this._translatedNoteSnapshot = await this.createTranslatedNoteSnapshot(sourceFile, sourceNote, translatedBody);
          this._translatedFilePath = sourceFile.path;
        } catch (e) {
          console.warn('[mtt] Failed to prepare translated-note snapshot:', e);
          failed++;
          this._translatedNoteSnapshot = null;
        }
      }
    }
    this._running = false;
    this._syncButton(view);
    this._translationView = null;

    if (!this._cancelled) {
      new Notice(i18n().pageDone(successful, failed, total));
    }
  }

  restorePage(view = this.plugin.app.workspace.activeLeaf?.view) {
    const container = this._getContainer(view);
    if (!container) {
      new Notice(i18n().pageRestoreReadingOnly);
      return;
    }
    this._stopObserving();
    this._translations.clear();
    this._translatedFilePath = null;
    this._translatedYamlProperties = null;
    this._translatedNoteSnapshot = null;
    this._translationSession = null;
    const translated = container.querySelectorAll('[data-mtt-orig]');
    if (translated.length === 0) {
      this._unwrapListLabels(container);
      new Notice(i18n().pageNoTranslated);
      return;
    }
    translated.forEach(el => {
      el.innerHTML = el.getAttribute('data-mtt-orig');
      el.removeAttribute('data-mtt-orig');
      el.removeAttribute('data-mtt-target');
      el.classList.remove('mtt-page-translated');
    });
    this._unwrapListLabels(container);
    this._syncButton(view);
    this._translationView = null;
    new Notice(i18n().pageRestored(translated.length));
  }
}

module.exports = class MouseTooltipPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    // DISABLED: transaction-log initialization and loading.
    // this.log = new TranslationLog(this.app, this.manifest.dir);
    // await this.log.load();
    this.glossary = new GlossaryStore(this.app, this.manifest.dir);
    await this.glossary.load();
    this.tooltip = new TooltipManager(this /*, this.log */);
    this.pageTranslator = new PageTranslator(this);
    this.pendingTimer = null;
    this.lastTriggerKey = '';
    // Selection-priority lock: while a non-empty selection exists, mouseover follow is paused
    // and the tooltip stays pinned to the selection translation.
    this.selectionActive = false;

    this.addSettingTab(new MouseTooltipSettingTab(this.app, this));

    // DISABLED: Open Vocabulary list view registration.
    // this.registerView(VOCAB_VIEW_TYPE, (leaf) => new VocabView(leaf, this));
    this.registerView(GLOSSARY_VIEW_TYPE, (leaf) => new GlossaryView(leaf, this));
    this.registerView(TRANS_VIEW_TYPE, (leaf) => new TranslationView(leaf, this));

    this.addRibbonIcon('message-square', i18n().ribbonTrans, () => this.openTransView());
    this.addRibbonIcon('book-open', i18n().ribbonGlossary, () => this.openGlossaryView());
    // DISABLED: Open Vocabulary list ribbon icon.
    // this.addRibbonIcon('book-open', i18n().ribbonVocab, () => this.openVocabView());
    this.ribbonPageEl = this.addRibbonIcon('languages', i18n().ribbonPage, () => {
      if (this.pageTranslator._running) {
        this.pageTranslator.cancel();
      } else if (this.pageTranslator.hasTranslation()) {
        this.pageTranslator.restorePage();
      } else {
        this.pageTranslator.translatePage();
      }
    });
    if (!(Platform.isMobile ? this.settings.enablePageMobile : this.settings.enablePage)) this.ribbonPageEl.style.display = 'none';

    this.addCommand({
      id: 'mtt-open-trans-panel',
      name: commandLabel('openPanel'),
      callback: () => this.openTransView(),
    });
    this.addCommand({
      id: 'mtt-open-glossary',
      name: commandLabel('openGlossary'),
      callback: () => this.openGlossaryView(),
    });
    // DISABLED: Open Vocabulary list command.
    // this.addCommand({
    //   id: 'mtt-open-vocab',
    //   name: commandLabel('openVocab'),
    //   callback: () => this.openVocabView(),
    // });
    this.addCommand({
      id: 'mtt-hide-tooltip',
      name: commandLabel('hideTooltip'),
      callback: () => this.tooltip.hide(),
    });
    this.addCommand({
      id: 'mtt-toggle-enabled',
      name: commandLabel('toggle'),
      callback: async () => {
        this.settings.enabled = !this.settings.enabled;
        await this.saveSettings();
        new Notice(i18n().pluginToggle(this.settings.enabled));
        if (!this.settings.enabled) this.tooltip.hide();
      },
    });
    this.addCommand({
      id: 'mtt-translate-selection',
      name: commandLabel('translateSelection'),
      callback: () => this.translateSelection(),
    });
    this.addCommand({
      id: 'mtt-translate-page',
      name: commandLabel('translatePage'),
      callback: () => this.pageTranslator.translatePage(),
    });
    this.addCommand({
      id: 'mtt-restore-page',
      name: commandLabel('restorePage'),
      callback: () => this.pageTranslator.restorePage(),
    });
    this.addCommand({
      id: 'mtt-copy-translation',
      name: commandLabel('copyTranslation'),
      callback: async () => {
        const result = this.tooltip.lastResult;
        const s = i18n();
        if (!result || !result.targetText) {
          new Notice(s.copyTranslationNone);
          return;
        }
        await navigator.clipboard.writeText(result.targetText);
        new Notice(s.copyTranslationNotice(result.targetText));
      },
    });
    this.addCommand({
      id: 'mtt-reload-glossary',
      name: commandLabel('reloadGlossary'),
      callback: async () => {
        await this.reloadGlossary();
        new Notice(`Glossary reloaded (${this.glossary.entries.length} active terms)`);
      },
    });

    // Add translate button to all current and future markdown view headers.
    const addButtons = () => {
      this.app.workspace.getLeavesOfType('markdown').forEach(leaf => {
        this._addPageTranslateButton(leaf.view);
      });
    };
    addButtons();
    this.registerEvent(this.app.workspace.on('layout-change', addButtons));

    this.registerDomEvent(document, 'keydown', (e) => {
      if (e.key === 'Escape') {
        this.tooltip.hide();
        // ESC also releases the selection lock so mouseover can resume
        this.selectionActive = false;
      }
    });
    this.registerDomEvent(document, 'scroll', () => {
      if (this.selectionActive) return;
      this.tooltip.hide();
    }, true);
    this.registerDomEvent(document, 'selectionchange', () => this.onSelectionChange());

    if (Platform.isMobile) {
      this.registerDomEvent(document, 'touchstart', (e) => {
        if (!this.tooltip.isOwn(e.target)) this.tooltip.hide();
      });
      this.registerDomEvent(document, 'touchend', (e) => this.onTouchEnd(e));
    } else {
      this.registerDomEvent(document, 'mousemove', (e) => this.onMouseMove(e));
      this.registerDomEvent(document, 'mouseleave', () => {
        // keep tooltip while a selection is locking it
        if (this.selectionActive) return;
        this.tooltip.hide();
      });
      this.registerDomEvent(document, 'mousedown', (e) => {
        if (!this.tooltip.isOwn(e.target)) this.tooltip.hide();
      });
      this.registerDomEvent(document, 'mouseup', (e) => this.onMouseUp(e));
    }

    console.log('[mouse-tooltip-translator] loaded');
  }

  refreshCommandLabels() {
    const commandKeys = {
      'mtt-open-trans-panel': 'openPanel',
      'mtt-open-glossary': 'openGlossary',
      // DISABLED: Open Vocabulary list command label.
      // 'mtt-open-vocab': 'openVocab',
      'mtt-hide-tooltip': 'hideTooltip',
      'mtt-toggle-enabled': 'toggle',
      'mtt-translate-selection': 'translateSelection',
      'mtt-translate-page': 'translatePage',
      'mtt-restore-page': 'restorePage',
      'mtt-copy-translation': 'copyTranslation',
      'mtt-reload-glossary': 'reloadGlossary',
      'mtt-save-translated-page': 'saveTranslated',
      'mtt-save-dual-language-page': 'saveDualLanguage',
    };
    for (const [id, key] of Object.entries(commandKeys)) {
      const command = this.app.commands?.commands?.[id];
      if (command) command.name = commandLabel(key);
    }
  }

  getConfiguredEngineKeys() {
    return [this.settings.mouseoverEngine, this.settings.selectionEngine, this.settings.pageEngine]
      .filter(Boolean);
  }

  getLanguagePickerEngineSetting() {
    const key = this.settings.languagePickerEngine;
    return ['mouseoverEngine', 'selectionEngine', 'pageEngine'].includes(key)
      ? key : 'pageEngine';
  }

  getLanguagePickerEngineKey() {
    const setting = this.getLanguagePickerEngineSetting();
    return this.settings[setting] || 'google';
  }

  getPageTranslationEngine() {
    const selected = this.settings.pageTranslationPanelEngine || 'pageEngine';
    return selected === 'pageEngine' ? (this.settings.pageEngine || 'google') : selected;
  }

  getLanguagePickerOptions(type, otherLanguage = '') {
    return getPairCompatibleLanguageOptions([this.getLanguagePickerEngineKey()], type, otherLanguage);
  }

  getLanguageCatalogSummary() {
    const key = this.getLanguagePickerEngineKey();
    const capabilities = getEngineCapabilities(key);
    const status = capabilities.catalog === 'model'
      ? 'model-defined'
      : capabilities.live ? 'live catalog' : 'bundled compatibility catalog';
    return `${ENGINE_LABELS[key] || key}: ${status}`;
  }

  assertLanguagePairSupported(engineKey, source, target) {
    if (!supportsLanguagePair(engineKey, source, target)) {
      throw new Error(languagePairError(engineKey, source, target));
    }
  }

  async reloadGlossary() {
    await this.glossary.load();
    // A revision-aware cache key prevents stale outputs after an export; clear
    // current memory too, so a malformed/missing revision cannot leave doubt.
    this.tooltip?.cache.clear();
    this.app.workspace.getLeavesOfType(GLOSSARY_VIEW_TYPE)
      .forEach(leaf => leaf.view?.render?.());
  }

  async translateWithGlossary(text, sourceLang, targetLang, engineKey) {
    const prepared = this.glossary.prepare(text, sourceLang, targetLang);
    if (prepared.exact) return this.glossary.apply(null, prepared, sourceLang, targetLang);
    const engine = ENGINES[engineKey] || ENGINES.google;
    const result = await engine.translate(prepared.text, sourceLang, targetLang, this.settings);
    return this.glossary.apply(result, prepared, sourceLang, targetLang);
  }

  async onunload() {
    if (this.pendingTimer) clearTimeout(this.pendingTimer);
    if (this.pageTranslator) this.pageTranslator.cancel();
    document.querySelectorAll('.mtt-page-btn,.mtt-page-engine-select,.mtt-page-save-btn,.mtt-page-dual-save-btn').forEach(el => el.remove());
    if (this.tooltip) await this.tooltip.destroy();
    // DISABLED: Open Vocabulary list cleanup.
    // this.app.workspace.detachLeavesOfType(VOCAB_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(GLOSSARY_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(TRANS_VIEW_TYPE);
  }

  async saveTranslatedPage(file) {
    if (!this.pageTranslator.canSaveTranslation(file)) {
      new Notice(i18n().pageSaveUnavailable);
      return;
    }
    const snapshot = this.pageTranslator.getTranslatedNoteSnapshot(file);
    if (!snapshot) {
      new Notice(i18n().pageSaveFailed);
      return;
    }
    const safeTitle = snapshot.title
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
      .replace(/[. ]+$/g, '')
      .trim();
    if (!safeTitle) {
      new Notice(i18n().pageSaveFailed);
      return;
    }
    const folder = file.parent?.path ? `${file.parent.path}/` : '';
    const stem = `${file.basename} (${safeTitle})`;
    let path = `${folder}${stem}.md`;
    let number = 2;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = `${folder}${stem} ${number++}.md`;
    }
    try {
      await this.app.vault.create(path, snapshot.content);
      new Notice(i18n().pageSaved(path));
    } catch (e) {
      console.error('[mtt] Failed to save translated page:', e);
      new Notice(i18n().pageSaveFailed);
    }
  }

  async saveDualLanguagePage(file, view) {
    const targetFile = file || view?.file || this.app.workspace.getActiveFile();
    if (!targetFile) {
      new Notice(i18n().pageSaveUnavailable);
      return;
    }
    let snapshot;
    try {
      snapshot = await this.pageTranslator.createDualLanguageNoteSnapshot(targetFile, view);
    } catch (e) {
      console.error('[mtt] Failed to prepare dual language note:', e);
      new Notice(i18n().pageDualSaveFailed);
      return;
    }
    const safeTitle = (snapshot.title || 'Translated')
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
      .replace(/[. ]+$/g, '')
      .trim();
    if (!safeTitle) {
      new Notice(i18n().pageDualSaveFailed);
      return;
    }
    const folder = targetFile.parent?.path ? `${targetFile.parent.path}/` : '';
    const stem = `${targetFile.basename} (${safeTitle})`;
    let path = `${folder}${stem}.md`;
    let number = 2;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = `${folder}${stem} ${number++}.md`;
    }
    try {
      await this.app.vault.create(path, snapshot.content);
      new Notice(i18n().pageDualSaved(path));
    } catch (e) {
      console.error('[mtt] Failed to save dual language note:', e);
      new Notice(i18n().pageDualSaveFailed);
    }
  }

  _addPageTranslateButton(view) {
    if (!(Platform.isMobile ? this.settings.enablePageMobile : this.settings.enablePage)) return;
    if (!view || typeof view.addAction !== 'function') return;
    let btn = view.containerEl?.querySelector('.mtt-page-btn');
    if (!btn) {
      btn = view.addAction('languages', i18n().ribbonPage, () => {
        if (this.pageTranslator._running) {
          this.pageTranslator.cancel();
        } else if (this.pageTranslator.hasTranslation(view)) {
          this.pageTranslator.restorePage(view);
        } else {
          this.pageTranslator.translatePage(view);
        }
      });
      btn.classList.add('mtt-page-btn');
    }
    let engineSelect = view.containerEl?.querySelector('.mtt-page-engine-select');
    if (!engineSelect && btn.parentElement) {
      engineSelect = document.createElement('select');
      engineSelect.className = 'mtt-page-engine-select';
      engineSelect.setAttribute('aria-label', i18n().pageTranslationEngine);
      engineSelect.title = i18n().pageTranslationEngine;
      const selected = this.settings.pageTranslationPanelEngine || 'pageEngine';
      const defaultOption = document.createElement('option');
      defaultOption.value = 'pageEngine';
      defaultOption.textContent = i18n().pageTranslationEngineDefault;
      engineSelect.appendChild(defaultOption);
      for (const key of TRANSLATION_PANEL_ENGINE_KEYS) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = ENGINE_LABELS[key] || key;
        engineSelect.appendChild(option);
      }
      engineSelect.value = ['pageEngine', ...TRANSLATION_PANEL_ENGINE_KEYS].includes(selected) ? selected : 'pageEngine';
      engineSelect.addEventListener('change', async () => {
        this.settings.pageTranslationPanelEngine = engineSelect.value;
        await this.saveSettings();
      });
      // Keep the primary Translate/Restore action first in the header.
      btn.insertAdjacentElement('afterend', engineSelect);
    }
    let saveBtn = view.containerEl?.querySelector('.mtt-page-save-btn');
    if (!saveBtn) {
      saveBtn = view.addAction('save', i18n().pageSaveTranslated, () => {
        const file = view.file || this.app.workspace.getActiveFile();
        if (file) void this.saveTranslatedPage(file);
      });
      saveBtn.classList.add('mtt-page-save-btn');
    }
    let dualSaveBtn = view.containerEl?.querySelector('.mtt-page-dual-save-btn');
    if (!dualSaveBtn) {
      dualSaveBtn = view.addAction('files', i18n().pageSaveDualLanguage, () => {
        const file = view.file || this.app.workspace.getActiveFile();
        if (file) void this.saveDualLanguagePage(file, view);
      });
      dualSaveBtn.classList.add('mtt-page-dual-save-btn');
    }
    this.pageTranslator._syncButton(view);
  }

  async openTransView() {
    const existing = this.app.workspace.getLeavesOfType(TRANS_VIEW_TYPE);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: TRANS_VIEW_TYPE, active: true });
      this.app.workspace.revealLeaf(leaf);
    }
  }

  async openGlossaryView() {
    const existing = this.app.workspace.getLeavesOfType(GLOSSARY_VIEW_TYPE);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: GLOSSARY_VIEW_TYPE, active: true });
      this.app.workspace.revealLeaf(leaf);
    }
  }

  /* DISABLED: Open Vocabulary list action.
  async openVocabView() {
    const existing = this.app.workspace.getLeavesOfType(VOCAB_VIEW_TYPE);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: VOCAB_VIEW_TYPE, active: true });
      this.app.workspace.revealLeaf(leaf);
    }
  }
  */

  _noteContentSelector() {
    switch (this.settings.activeMode) {
      case 'edit':    return '.cm-content, .markdown-rendered';
      case 'reading': return '.markdown-preview-view, .markdown-rendered';
      default:        return NOTE_CONTENT_SELECTOR;
    }
  }

  onMouseMove(e) {
    if (!this.settings.enabled) return;
    if (this.tooltip.isOwn(e.target)) return;
    if (this.settings.restrictToNoteContent && !isInNoteContent(e.target, this._noteContentSelector())) {
      if (this.pendingTimer) { clearTimeout(this.pendingTimer); this.pendingTimer = null; }
      if (!this.selectionActive) this.tooltip.hide();
      return;
    }
    if (this.pendingTimer) { clearTimeout(this.pendingTimer); this.pendingTimer = null; }

    if (!this.settings.enableHover) return;
    // While a selection is active, freeze the tooltip on the selection translation.
    if (this.selectionActive) return;

    const x = e.clientX, y = e.clientY;

    // Page-translation hover mode: show pre-translation original of the hovered paragraph.
    if (this.settings.pageTranslationHoverOriginal && this.pageTranslator.hasTranslation()) {
      this.pendingTimer = window.setTimeout(() => {
        this.pendingTimer = null;
        if (this.selectionActive) return;
        const target = document.elementFromPoint(x, y);
        const block = target?.closest('[data-mtt-orig]');
        if (block) {
          const origText = getOriginalText(block);
          if (origText) {
            this.tooltip.showPlain(origText, block.getBoundingClientRect());
            return;
          }
        }
        this.tooltip.hide();
      }, Math.max(0, this.settings.delayMs | 0));
      return;
    }

    this.pendingTimer = window.setTimeout(() => {
      this.pendingTimer = null;
      // Re-check: a drag-selection may have started during the hover delay.
      if (this.selectionActive) return;
      const hit = extractAtPoint(x, y, this.settings.textType);
      if (!hit) { this.tooltip.hide(); return; }
      this.tooltip.show(hit.text, hit.rect, this.settings.mouseoverEngine);
    }, Math.max(0, this.settings.delayMs | 0));
  }

  onMouseUp(_e) {
    if (!this.settings.enabled) return;
    // While page-translation hover mode is active, suppress selection-based translation
    // (selected text would be translated text, not original).
    if (this.settings.pageTranslationHoverOriginal && this.pageTranslator.hasTranslation()) return;
    if (!this.settings.enableSelection) return;
    // Scope is judged from the selection itself (anchorNode), not from where the mouse
    // was released — a fast drag can land the cursor outside note content even when
    // the selection is entirely inside it.
    setTimeout(() => {
      if (this.settings.restrictToNoteContent) {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;
        const _sel = this._noteContentSelector();
        if (!isInNoteContent(sel.anchorNode, _sel) && !isInNoteContent(sel.focusNode, _sel)) return;
      }
      this.translateSelection();
    }, 0);
  }

  onSelectionChange() {
    if (!this.settings.enabled) return;
    if (this.settings.pageTranslationHoverOriginal && this.pageTranslator.hasTranslation()) return;
    if (!this.settings.enableSelection) return;
    const sel = window.getSelection();
    const hasSelection = !!(sel && !sel.isCollapsed && sel.toString().trim());
    if (hasSelection) {
      if (this.settings.restrictToNoteContent) {
        const _sel = this._noteContentSelector();
        if (!isInNoteContent(sel.anchorNode, _sel) && !isInNoteContent(sel.focusNode, _sel)) return;
      }
      // Lock onto the selection — mousemove follow is suspended.
      this.selectionActive = true;
    } else if (this.selectionActive) {
      // Selection cleared — release lock and let mouseover resume.
      this.selectionActive = false;
      this.tooltip.hide();
    }
  }

  translateSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
    if (!text) return;
    let rect;
    try {
      rect = sel.getRangeAt(0).getBoundingClientRect();
    } catch { rect = null; }
    if (!rect) return;
    this.tooltip.show(text, rect, this.settings.selectionEngine);
  }

  onTouchEnd(e) {
    if (!this.settings.enabled) return;
    if (this.tooltip.isOwn(e.target)) return;

    // Page-translation tap mode: show pre-translation original of the tapped paragraph.
    if (this.settings.pageTranslationHoverOriginal && this.pageTranslator.hasTranslation()) {
      const touch = e.changedTouches[0];
      if (!touch) return;
      const x = touch.clientX, y = touch.clientY;
      setTimeout(() => {
        const target = document.elementFromPoint(x, y);
        const block = target?.closest('[data-mtt-orig]');
        if (block) {
          const origText = getOriginalText(block);
          if (origText) {
            this.tooltip.showPlain(origText, block.getBoundingClientRect());
            return;
          }
        }
        this.tooltip.hide();
      }, 100);
      return;
    }

    // Delay to let the browser finalize selection state after touch
    setTimeout(() => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim()) {
        if (!this.settings.enableSelectionMobile) return;
        if (this.settings.restrictToNoteContent) {
          const _sel = this._noteContentSelector();
          if (!isInNoteContent(sel.anchorNode, _sel) && !isInNoteContent(sel.focusNode, _sel)) return;
        }
        this.translateSelection();
        return;
      }
      // No selection: try word at touch point
      if (!this.settings.enableHoverMobile) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const x = touch.clientX, y = touch.clientY;
      if (this.settings.restrictToNoteContent) {
        const el = document.elementFromPoint(x, y);
        if (el && !isInNoteContent(el, this._noteContentSelector())) return;
      }
      const hit = extractAtPoint(x, y, 'word');
      if (hit) {
        this.tooltip.show(hit.text, hit.rect, this.settings.selectionEngine);
      }
    }, 100);
  }

  async loadSettings() {
    const loaded = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    _mttSettings = this.settings;
    // Migrate old single 'engine' setting to per-context engines
    if (loaded?.engine) {
      if (!loaded.mouseoverEngine) this.settings.mouseoverEngine = loaded.engine;
      if (!loaded.selectionEngine) this.settings.selectionEngine = loaded.engine;
      if (!loaded.pageEngine) this.settings.pageEngine = loaded.engine;
    }
    // The dedicated legacy engine was removed. Preserve existing users' basic
    // connection details by moving it to the provider-profiled API engine.
    const removedEngineKeys = ['mouseoverEngine', 'selectionEngine', 'pageEngine'];
    const usedRemovedEngine = removedEngineKeys.some((key) => this.settings[key] === 'openaiCompat');
    if (usedRemovedEngine) {
      for (const key of removedEngineKeys) {
        if (this.settings[key] === 'openaiCompat') this.settings[key] = 'localLlm';
      }
      this.settings.llmProvider = 'custom';
      this.settings.llmApiEndpoint = loaded?.openaiCompatApiUrl || this.settings.llmApiEndpoint;
      this.settings.llmApiKey = loaded?.openaiCompatApiKey || this.settings.llmApiKey;
      this.settings.llmModel = loaded?.openaiCompatModel || this.settings.llmModel;
    }
  }
  async saveSettings() {
    await this.saveData(this.settings);
    _mttSettings = this.settings;
  }
};

class MouseTooltipSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this._legacyLlmModels = [];
    this._legacyLlmModelDatalist = null;
  }

  _applyLegacyLlmProvider(provider) {
    const settings = this.plugin.settings;
    const previous = settings.llmProvider || 'custom';
    if (provider === previous) return;
    const saved = { ...(settings.llmProviderSettings || {}) };
    saved[previous] = {
      apiEndpoint: settings.llmApiEndpoint || '', apiKey: settings.llmApiKey || '', model: settings.llmModel || '',
    };
    settings.llmProviderSettings = saved;
    const restored = saved[provider];
    settings.llmApiEndpoint = restored?.apiEndpoint ?? (provider === 'custom' ? '' : (LLM_PROVIDER_ENDPOINTS[provider] || ''));
    settings.llmApiKey = restored?.apiKey || '';
    settings.llmModel = restored?.model || '';
    settings.llmProvider = provider;
    this._legacyLlmModels = [];
  }

  _fillLegacyLlmModelDatalist() {
    if (!this._legacyLlmModelDatalist) return;
    this._legacyLlmModelDatalist.textContent = '';
    for (const model of this._legacyLlmModels) this._legacyLlmModelDatalist.createEl('option', { value: model });
  }

  async _fetchLegacyLlmModels() {
    const settings = this.plugin.settings;
    if (!settings.llmApiEndpoint) { new Notice(i18n().llmFetchNoEndpoint); return; }
    try {
      const models = await LocalLlmEngine.getModels(settings.llmApiEndpoint, settings.llmApiKey);
      if (!models.length) { new Notice(i18n().llmFetchNoModels); return; }
      this._legacyLlmModels = models;
      this._fillLegacyLlmModelDatalist();
      new Notice(i18n().llmFetchOk(models.length));
    } catch (error) {
      console.error('[mtt] Failed to fetch legacy LLM models:', error);
      new Notice(i18n().llmFetchFailed(error?.message || String(error)));
    }
  }

  _addLanguageOptions(dropdown, type, savedValue, otherLanguage) {
    const available = this.plugin.getLanguagePickerOptions(type, otherLanguage);
    for (const code of available) dropdown.addOption(code, languageOptionLabel(code));
    if (!available.includes(savedValue)) {
      // Never overwrite a user's old setting solely because an engine changed.
      dropdown.addOption(savedValue, unsupportedLanguageOption(savedValue));
    }
    return available;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    const s = i18n();
    containerEl.createEl('h2', { text: 'True Buddha Translator' });

    new Setting(containerEl)
      .setName(s.documentation)
      .setDesc(s.documentationDesc)
      .addButton((button) => button
        .setButtonText(s.openDocumentation)
        .setCta()
        .onClick(() => window.open('https://github.com/tbspedia/tbpedia-translator/blob/main/README.md')));

    // ---- UI Language ----
    new Setting(containerEl)
      .setName(s.uiLang)
      .setDesc(s.uiLangDesc)
      .addDropdown((d) => d
        .addOption('system', s.uiLangSystem)
        .addOption('en', 'English')
        .addOption('zh-TW', '中文（繁體）')
        .addOption('zh-CN', '中文（简体）')
        .addOption('id', 'Bahasa Indonesia')
        .addOption('ja', '日本語')
        .addOption('ko', '한국어')
        .addOption('vi', 'Tiếng Việt')
        .addOption('th', 'ภาษาไทย')
        .addOption('de', 'Deutsch')
        .addOption('sv', 'Svenska')
        .addOption('nl', 'Nederlands')
        .addOption('es', 'Español')
        .addOption('fr', 'Français')
        .setValue(this.plugin.settings.uiLang)
        .onChange(async (v) => {
          this.plugin.settings.uiLang = v;
          await this.plugin.saveSettings();
          this.plugin.refreshCommandLabels();
          this.plugin.app.workspace.getLeavesOfType(TRANS_VIEW_TYPE).forEach((leaf) => {
            leaf.view?._refreshLanguageSelectors?.();
          });
          this.display();
        }));

    // ---- Master Toggle ----
    new Setting(containerEl)
      .setName(s.masterEnabled)
      .setDesc(s.masterEnabledDesc)
      .addToggle((t) => t
        .setValue(this.plugin.settings.enabled)
        .onChange(async (v) => { this.plugin.settings.enabled = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName(s.masterRestrict)
      .setDesc(s.masterRestrictDesc)
      .addToggle((t) => t
        .setValue(this.plugin.settings.restrictToNoteContent)
        .onChange(async (v) => {
          this.plugin.settings.restrictToNoteContent = v;
          await this.plugin.saveSettings();
          this.plugin.tooltip.hide();
          this.display();
        }));

    // ---- Features ----
    containerEl.createEl('h3', { text: s.secFeatures });

    containerEl.createEl('h4', { text: s.secDesktop });

    new Setting(containerEl)
      .setName(s.featHover)
      .setDesc(s.featHoverDesc)
      .addToggle((t) => t
        .setValue(this.plugin.settings.enableHover)
        .onChange(async (v) => { this.plugin.settings.enableHover = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName(s.featSelection)
      .setDesc(s.featSelectionDesc)
      .addToggle((t) => t
        .setValue(this.plugin.settings.enableSelection)
        .onChange(async (v) => { this.plugin.settings.enableSelection = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName(s.featPage)
      .setDesc(s.featPageDesc)
      .addToggle((t) => t
        .setValue(this.plugin.settings.enablePage)
        .onChange(async (v) => {
          this.plugin.settings.enablePage = v;
          await this.plugin.saveSettings();
          if (!Platform.isMobile) {
            if (this.plugin.ribbonPageEl) this.plugin.ribbonPageEl.style.display = v ? '' : 'none';
            if (v) {
              this.plugin.app.workspace.getLeavesOfType('markdown').forEach(leaf => this.plugin._addPageTranslateButton(leaf.view));
            } else {
              document.querySelectorAll('.mtt-page-btn,.mtt-page-engine-select,.mtt-page-save-btn,.mtt-page-dual-save-btn').forEach(el => el.remove());
            }
          }
        }));

    containerEl.createEl('h4', { text: s.secMobile });

    new Setting(containerEl)
      .setName(s.featHoverMobile)
      .setDesc(s.featHoverMobileDesc)
      .addToggle((t) => t
        .setValue(this.plugin.settings.enableHoverMobile)
        .onChange(async (v) => { this.plugin.settings.enableHoverMobile = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName(s.featSelectionMobile)
      .setDesc(s.featSelectionMobileDesc)
      .addToggle((t) => t
        .setValue(this.plugin.settings.enableSelectionMobile)
        .onChange(async (v) => { this.plugin.settings.enableSelectionMobile = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName(s.featPageMobile)
      .setDesc(s.featPageMobileDesc)
      .addToggle((t) => t
        .setValue(this.plugin.settings.enablePageMobile)
        .onChange(async (v) => {
          this.plugin.settings.enablePageMobile = v;
          await this.plugin.saveSettings();
          if (Platform.isMobile) {
            if (this.plugin.ribbonPageEl) this.plugin.ribbonPageEl.style.display = v ? '' : 'none';
            if (v) {
              this.plugin.app.workspace.getLeavesOfType('markdown').forEach(leaf => this.plugin._addPageTranslateButton(leaf.view));
            } else {
              document.querySelectorAll('.mtt-page-btn,.mtt-page-engine-select,.mtt-page-save-btn,.mtt-page-dual-save-btn').forEach(el => el.remove());
            }
          }
        }));

    // ---- Translation ----
    containerEl.createEl('h3', { text: s.secTranslation });

    new Setting(containerEl)
      .setName(s.languagePickerEngine)
      .setDesc(s.languagePickerEngineDesc)
      .addDropdown((d) => d
        .addOption('mouseoverEngine', s.engineHover)
        .addOption('selectionEngine', s.engineSelection)
        .addOption('pageEngine', s.enginePage)
        .setValue(this.plugin.getLanguagePickerEngineSetting())
        .onChange(async (v) => {
          this.plugin.settings.languagePickerEngine = v;
          await this.plugin.saveSettings();
          this.display();
        }));

    new Setting(containerEl)
      .setName(s.languageCatalogStatus)
      .setDesc(`${s.languageCatalogDesc}\n\n${this.plugin.getLanguageCatalogSummary()}`);

    new Setting(containerEl)
      .setName(s.translateFrom)
      .addDropdown((d) => {
        this._addLanguageOptions(d, 'sources', this.plugin.settings.sourceLang, this.plugin.settings.targetLang);
        d.setValue(this.plugin.settings.sourceLang)
          .onChange(async (v) => {
            this.plugin.settings.sourceLang = v;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    new Setting(containerEl)
      .setName(s.translateTo)
      .addDropdown((d) => {
        this._addLanguageOptions(d, 'targets', this.plugin.settings.targetLang, this.plugin.settings.sourceLang);
        d.setValue(this.plugin.settings.targetLang)
          .onChange(async (v) => {
            this.plugin.settings.targetLang = v;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    new Setting(containerEl)
      .setName(s.skipSame)
      .setDesc(s.skipSameDesc)
      .addToggle((t) => t
        .setValue(this.plugin.settings.skipSameLanguage)
        .onChange(async (v) => {
          this.plugin.settings.skipSameLanguage = v;
          await this.plugin.saveSettings();
          this.plugin.tooltip.hide();
        }));

    new Setting(containerEl)
      .setName(s.skipIdentical)
      .setDesc(s.skipIdenticalDesc)
      .addToggle((t) => t
        .setValue(this.plugin.settings.skipIdenticalText)
        .onChange(async (v) => {
          this.plugin.settings.skipIdenticalText = v;
          await this.plugin.saveSettings();
          this.plugin.tooltip.hide();
        }));

    new Setting(containerEl)
      .setName(s.fallbackEngine)
      .setDesc(s.fallbackEngineDesc)
      .addToggle((t) => t
        .setValue(this.plugin.settings.fallbackTranslatorEngine !== false)
        .onChange(async (v) => {
          this.plugin.settings.fallbackTranslatorEngine = v;
          await this.plugin.saveSettings();
        }));

    // ---- Engine Settings ----
    containerEl.createEl('h3', { text: s.secEngines });

    const engineConfigs = [
      { key: 'mouseoverEngine', name: s.engineHover,     desc: s.engineHoverDesc },
      { key: 'selectionEngine', name: s.engineSelection, desc: s.engineSelectionDesc },
      { key: 'pageEngine',      name: s.enginePage,      desc: s.enginePageDesc },
    ];
    const llmEngineLabels = {
      localLlm: s.llmOpenai, ollama: s.engOllama, lmstudio: s.engLmstudio,
    };
    for (const { key, name, desc } of engineConfigs) {
      new Setting(containerEl)
        .setName(name)
        .setDesc(desc)
        .addDropdown((d) => {
          for (const [k, v] of Object.entries(ENGINES)) d.addOption(k, llmEngineLabels[k] ?? v.label);
          d.setValue(this.plugin.settings[key] || 'google')
            .onChange(async (v) => {
              this.plugin.settings[key] = v;
              // The list belongs to the engine that was just edited, so its
              // source/target options visibly refresh with that engine.
              this.plugin.settings.languagePickerEngine = key;
              await this.plugin.saveSettings();
              this.display();
            });
        });
    }

    // LLM engine settings (shown once per unique LLM engine in use)
    const usedLLMs = [...new Set(
      [this.plugin.settings.mouseoverEngine, this.plugin.settings.selectionEngine, this.plugin.settings.pageEngine]
        .filter(e => LLM_ENGINE_KEYS.has(e))
    )];
    if (usedLLMs.includes('localLlm')) {
      containerEl.createEl('h4', { text: s.llmOpenai });
      new Setting(containerEl)
        .setName(s.llmProvider)
        .setDesc(s.llmProviderDesc)
        .addDropdown((d) => {
          for (const [key, label] of Object.entries(LLM_PROVIDER_LABELS)) d.addOption(key, label);
          d.setValue(this.plugin.settings.llmProvider || 'custom')
            .onChange(async (value) => {
              this._applyLegacyLlmProvider(value);
              await this.plugin.saveSettings();
              this.display();
            });
        });
      new Setting(containerEl)
        .setName(s.llmApiUrl)
        .setDesc(s.llmApiUrlDescLegacy)
        .addText((t) => {
          t.setPlaceholder('http://localhost:11434/v1')
            .setValue(this.plugin.settings.llmApiEndpoint || '')
            .onChange(async (value) => { this.plugin.settings.llmApiEndpoint = value.trim(); await this.plugin.saveSettings(); });
          if ((this.plugin.settings.llmProvider || 'custom') !== 'custom') t.setDisabled(true);
        });
      new Setting(containerEl)
        .setName(s.llmApiKey)
        .addText((t) => {
          t.setPlaceholder('sk-...').setValue(this.plugin.settings.llmApiKey || '')
            .onChange(async (value) => { this.plugin.settings.llmApiKey = value.trim(); await this.plugin.saveSettings(); });
          t.inputEl.type = 'password';
        });
      new Setting(containerEl)
        .setName(s.llmModel)
        .setDesc(s.llmModelDescLegacy)
        .addText((t) => {
          t.setPlaceholder('gpt-4o-mini, llama3')
            .setValue(this.plugin.settings.llmModel || '')
            .onChange(async (value) => { this.plugin.settings.llmModel = value.trim(); await this.plugin.saveSettings(); });
          const datalist = document.createElement('datalist');
          datalist.id = 'mtt-legacy-llm-models';
          t.inputEl.setAttribute('list', datalist.id);
          t.inputEl.parentElement?.appendChild(datalist);
          this._legacyLlmModelDatalist = datalist;
          this._fillLegacyLlmModelDatalist();
        })
        .addExtraButton((b) => b.setIcon('refresh-cw').setTooltip(s.llmFetchModels).onClick(() => this._fetchLegacyLlmModels()));
    }
    for (const eng of usedLLMs.filter((key) => key !== 'localLlm')) {
      containerEl.createEl('h4', { text: eng === 'ollama' ? s.llmOllama : s.llmLmstudio });

      new Setting(containerEl)
        .setName(s.llmApiUrl)
        .setDesc(eng === 'ollama' ? s.llmApiUrlDescOllama : s.llmApiUrlDescLmstudio)
        .addText((t) => {
          const urlKey = eng === 'ollama' ? 'ollamaApiUrl' : 'lmstudioApiUrl';
          t.setPlaceholder(eng === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234')
            .setValue(this.plugin.settings[urlKey] || '')
            .onChange(async (v) => { this.plugin.settings[urlKey] = v.trim(); await this.plugin.saveSettings(); });
        });

      new Setting(containerEl)
        .setName(s.llmModel)
        .setDesc(eng === 'ollama' ? s.llmModelDescOllama : s.llmModelDescLmstudio)
        .addText((t) => {
          const modelKey = eng === 'ollama' ? 'ollamaModel' : 'lmstudioModel';
          t.setPlaceholder('')
            .setValue(this.plugin.settings[modelKey] || '')
            .onChange(async (v) => { this.plugin.settings[modelKey] = v.trim(); await this.plugin.saveSettings(); });
        });

      const tempKey = eng === 'ollama' ? 'ollamaTemperature' : 'lmstudioTemperature';
      new Setting(containerEl)
        .setName(s.llmTemp)
        .setDesc(s.llmTempDesc)
        .addSlider((sl) => sl
          .setLimits(0, 2, 0.1)
          .setValue(this.plugin.settings[tempKey] ?? 0)
          .setDynamicTooltip()
          .onChange(async (v) => { this.plugin.settings[tempKey] = v; await this.plugin.saveSettings(); }));

      const promptKey = eng === 'ollama' ? 'ollamaPrompt' : 'lmstudioPrompt';
      const promptSetting = new Setting(containerEl)
        .setName(s.llmPrompt)
        .setDesc(s.llmPromptDesc);
      promptSetting.addTextArea((ta) => {
        ta.setPlaceholder('Translate the following text to {{targetLang}}. Output only the translated text, nothing else.\n\n{{text}}')
          .setValue(this.plugin.settings[promptKey] || '')
          .onChange(async (v) => { this.plugin.settings[promptKey] = v; await this.plugin.saveSettings(); });
        ta.inputEl.rows = 4;
        ta.inputEl.style.width = '100%';
        ta.inputEl.style.fontFamily = 'monospace';
        ta.inputEl.style.fontSize = '12px';
      });
    }

    // ---- Per-feature Settings ----
    containerEl.createEl('h3', { text: s.secPerFeature });

    containerEl.createEl('h4', { text: s.secHoverSelection });

    if (this.plugin.settings.restrictToNoteContent) {
      new Setting(containerEl)
        .setName(s.activeMode)
        .setDesc(s.activeModeDesc)
        .addDropdown((d) => d
          .addOption('both', s.modeBoth)
          .addOption('edit', s.modeEdit)
          .addOption('reading', s.modeReading)
          .setValue(this.plugin.settings.activeMode || 'both')
          .onChange(async (v) => {
            this.plugin.settings.activeMode = v;
            await this.plugin.saveSettings();
            this.plugin.tooltip.hide();
          }));
    }

    new Setting(containerEl)
      .setName(s.mouseUnit)
      .setDesc(s.mouseUnitDesc)
      .addDropdown((d) => d
        .addOption('word', s.unitWord)
        .addOption('sentence', s.unitSentence)
        .setValue(this.plugin.settings.textType)
        .onChange(async (v) => { this.plugin.settings.textType = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName(s.hoverDelay)
      .setDesc(s.hoverDelayDesc)
      .addText((t) => t
        .setPlaceholder('500')
        .setValue(String(this.plugin.settings.delayMs))
        .onChange(async (v) => {
          const n = Number(v);
          if (!Number.isFinite(n) || n < 0) return;
          this.plugin.settings.delayMs = n;
          await this.plugin.saveSettings();
        }));

    containerEl.createEl('h4', { text: s.secPage });

    new Setting(containerEl)
      .setName(s.pageHoverOrig)
      .setDesc(s.pageHoverOrigDesc)
      .addToggle((t) => t
        .setValue(this.plugin.settings.pageTranslationHoverOriginal)
        .onChange(async (v) => {
          this.plugin.settings.pageTranslationHoverOriginal = v;
          await this.plugin.saveSettings();
          this.plugin.tooltip.hide();
        }));

    new Setting(containerEl)
      .setName(s.pageTranslateYaml)
      .setDesc(s.pageTranslateYamlDesc)
      .addToggle((t) => t
        .setValue(this.plugin.settings.translateYamlPropertyValues)
        .onChange(async (v) => {
          this.plugin.settings.translateYamlPropertyValues = v;
          await this.plugin.saveSettings();
        }));

    // ---- Tooltip Contents ----
    containerEl.createEl('h3', { text: s.secTooltip });

    new Setting(containerEl)
      .setName(s.showDict)
      .setDesc(s.showDictDesc)
      .addToggle((t) => t
        .setValue(this.plugin.settings.showDictionary)
        .onChange(async (v) => { this.plugin.settings.showDictionary = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName(s.showTranslit)
      .setDesc(s.showTranslitDesc)
      .addToggle((t) => t
        .setValue(this.plugin.settings.showTransliteration)
        .onChange(async (v) => { this.plugin.settings.showTransliteration = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName(s.showSource)
      .addToggle((t) => t
        .setValue(this.plugin.settings.showSourceText)
        .onChange(async (v) => { this.plugin.settings.showSourceText = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName(s.showDetected)
      .addToggle((t) => t
        .setValue(this.plugin.settings.showDetectedLang)
        .onChange(async (v) => { this.plugin.settings.showDetectedLang = v; await this.plugin.saveSettings(); }));
  }
}
