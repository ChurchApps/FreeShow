<script lang="ts">
    import { onMount } from "svelte"
    import type { AiScriptureEngine, AIError, AIProviderId, NemotronStatus, WhisperModelId, WhisperStatus } from "../../../../types/AiScripture"
    import { AI_PROVIDER_MODELS, WHISPER_LANGUAGES } from "../../../../types/AiScripture"
    import { Main } from "../../../../types/IPC/Main"
    import { aiScriptureErrorText } from "../../../audio/aiScripture"
    import { AudioMicrophone } from "../../../audio/audioMicrophone"
    import { requestMain, sendMain } from "../../../IPC/main"
    import { language, os, scriptures, special, aiScriptureDownloads } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { keysToID, sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import Title from "../../input/Title.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialCheckbox from "../../inputs/MaterialCheckbox.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialFilePicker from "../../inputs/MaterialFilePicker.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"
    import Loader from "../../main/Loader.svelte"
    import Tip from "../../main/Tip.svelte"
    import { stopAiScriptureListening } from "../../../audio/aiScripture"

    $: settings = ($special.aiScripture || {}) as { [key: string]: any }

    function update(key: string, value: any) {
        special.update((a) => ({ ...a, aiScripture: { ...(a.aiScripture || {}), [key]: value } }))
    }

    // STATUS

    let status: { keys: { [id in AIProviderId]: boolean }; whisper: WhisperStatus; nemotron: NemotronStatus } | null = null
    async function getStatus() {
        const result = await requestMain(Main.AI_SCRIPTURE_GET_STATUS)
        // an older electron process (dev: the frontend hot reloads, main does not) answers without the engine state -
        // default it rather than letting a missing field throw and leave the section stuck on its loader
        status = result ? { ...result, nemotron: result.nemotron || { supported: false, ready: false } } : null
    }

    let microphones: { value: string; label: string }[] = []
    onMount(() => {
        getStatus()

        if ($special.aiScripture?.whisperCustomPath) verifyCustomPath($special.aiScripture.whisperCustomPath)

        AudioMicrophone.getList().then((devices) => {
            microphones = devices.map((device) => ({ value: device.deviceId, label: device.label }))

            // auto select the system default so listening captures the right input without any manual choice
            if (!$special.aiScripture?.micDeviceId && devices.length) {
                update("micDeviceId", devices.find((device) => device.deviceId === "default")?.deviceId || devices[0].deviceId)
            }
        })
    })

    // TRANSCRIPTION ENGINE

    $: platform = $os.platform

    // whisper transcribes fixed windows, the streaming engine decodes as the words arrive - see the driver contract in electron/aiScripture/drivers
    const engineOptions = [
        { value: "whisper", label: translateText("settings.ai_engine_whisper") },
        { value: "nemotron", label: translateText("settings.ai_engine_nemotron") }
    ]
    $: engine = ((settings.engine as string) || "whisper") as AiScriptureEngine

    // TRANSCRIPTION (WHISPER)

    const languageOptions = WHISPER_LANGUAGES.map((a) => ({ value: a.code, label: a.name }))

    $: spokenLanguage = ((settings.spokenLanguage as string) || ($language || "en").slice(0, 2)).toLowerCase()
    $: interpretationMode = settings.interpretationMode === true
    // interpretation mode auto-detects the language per window - that needs a multilingual model, never an .en variant
    $: englishOnly = spokenLanguage === "en" && !interpretationMode
    const hasEnVariant = (base: string) => base !== "large-v3"
    $: whisperModelBase = ((settings.whisperModel as string) || "base").replace(".en", "")
    $: whisperModelId = (englishOnly && hasEnVariant(whisperModelBase) ? `${whisperModelBase}.en` : whisperModelBase) as WhisperModelId
    $: modelDownloaded = !!status?.whisper.downloadedModels.includes(whisperModelId)

    $: binaryInstalled = !!status && (status.whisper.binary !== "not_installed" || customPathValid)

    const whisperModelSizes: { [key: string]: number } = { tiny: 75, base: 142, small: 466, medium: 1500, "large-v3": 3100 }
    const whisperModelKeys: { [key: string]: string } = { "large-v3": "large" } // dropdown ids not matching their i18n key
    $: whisperModelOptions = ["tiny", "base", "small", "medium", "large-v3"].map((id) => ({ value: id, label: `${translateText(`settings.ai_whisper_model_${whisperModelKeys[id] || id}`)} (${whisperModelSizes[id]} MB)` }))

    function setWhisperModel(base: string) {
        update("whisperModel", englishOnly && hasEnVariant(base) ? `${base}.en` : base)
    }

    function setSpokenLanguage(code: string) {
        const languageCode = (code || "").trim().toLowerCase().slice(0, 2) || ($language || "en").slice(0, 2).toLowerCase()
        update("spokenLanguage", languageCode)

        // keep the derived English-only model variant in sync
        const base = ((settings.whisperModel as string) || "base").replace(".en", "")
        update("whisperModel", languageCode === "en" && !interpretationMode && hasEnVariant(base) ? `${base}.en` : base)
    }

    function toggleInterpretation(enabled: boolean) {
        update("interpretationMode", enabled)

        // re-derive the model: multilingual while interpretation is on, back to the .en variant for English otherwise
        const base = ((settings.whisperModel as string) || "base").replace(".en", "")
        update("whisperModel", !enabled && spokenLanguage === "en" && hasEnVariant(base) ? `${base}.en` : base)
    }

    // LANGUAGES SPOKEN (interpretation mode)
    // the declared set constrains whisper's per-window language guess - default: the speaker & detection languages

    $: listenLanguage = ((settings.listenLanguage as string) || spokenLanguage) as string
    $: spokenLanguages = ((settings.spokenLanguages as string[]) || Array.from(new Set([spokenLanguage, listenLanguage]))) as string[]

    function toggleSpokenLanguage(code: string, checked: boolean) {
        const list = spokenLanguages.filter((languageCode) => languageCode !== code)
        if (checked) list.push(code)
        update("spokenLanguages", list)
    }

    // scripture detection can only listen to a language that is actually spoken - full list until a real set is picked
    $: listenLanguageOptions = spokenLanguages.length >= 2 ? languageOptions.filter((option) => spokenLanguages.includes(option.value)) : languageOptions

    // DOWNLOADS

    type DownloadInfo = { progress: number; total: number; status: "downloading" | "complete" | "error"; message?: string }
    // names are assigned by the electron process: "whisper" (binary), "whisper-model-<id>" and "nemotron".
    // matching has to be exact - a loose match would show one engine's progress under the other's button
    function getDownload(name: string, _updater: any = null): DownloadInfo | null {
        return $aiScriptureDownloads.get(name) || null
    }

    function getPercent(download: DownloadInfo | null) {
        if (!download?.total) return 0
        return Math.min(100, Math.round((download.progress / download.total) * 100))
    }

    let binaryDownloading = false
    let binaryError = ""
    async function downloadBinary() {
        if (binaryDownloading) return
        binaryDownloading = true
        binaryError = ""

        const result = await requestMain(Main.AI_SCRIPTURE_WHISPER_DOWNLOAD_BINARY, undefined, undefined, 60 * 60 * 1000)
        binaryDownloading = false
        if (result && !result.ok) binaryError = result.error || ""
        getStatus()
    }

    let modelDownloading = false
    let modelError = ""
    async function downloadModel() {
        if (modelDownloading) return
        modelDownloading = true
        modelError = ""

        const result = await requestMain(Main.AI_SCRIPTURE_WHISPER_DOWNLOAD_MODEL, { modelId: whisperModelId }, undefined, 60 * 60 * 1000)
        modelDownloading = false
        if (result && !result.ok) modelError = result.error || ""
        getStatus()
    }

    function cancelDownload() {
        sendMain(Main.AI_SCRIPTURE_WHISPER_CANCEL)
    }

    // driven by the progress store, not the local click flags, so reopening the popup mid-download still shows live progress
    $: binaryDownload = getDownload("whisper", $aiScriptureDownloads)
    $: modelDownload = getDownload(`whisper-model-${whisperModelId}`, $aiScriptureDownloads)
    $: binaryActive = binaryDownloading || binaryDownload?.status === "downloading"
    $: modelActive = modelDownloading || modelDownload?.status === "downloading"

    // a download that finished while the popup was closed still refreshes the "model downloaded" state
    $: if (modelDownload?.status === "complete" && status && !modelDownloaded) getStatus()

    // NEMOTRON MODEL (streaming engine)

    let nemotronDownloading = false
    let nemotronError = ""
    async function downloadNemotron() {
        if (nemotronDownloading) return
        nemotronDownloading = true
        nemotronError = ""

        const result = await requestMain(Main.AI_SCRIPTURE_NEMOTRON_DOWNLOAD, undefined, undefined, 60 * 60 * 1000)
        nemotronDownloading = false
        if (result && !result.ok) nemotronError = result.error || ""
        getStatus()
    }

    function cancelNemotronDownload() {
        sendMain(Main.AI_SCRIPTURE_NEMOTRON_CANCEL)
    }

    function deleteNemotronModel() {
        sendMain(Main.AI_SCRIPTURE_NEMOTRON_DELETE)
        setTimeout(getStatus, 200)
    }

    $: nemotronDownload = getDownload("nemotron", $aiScriptureDownloads)
    $: nemotronActive = nemotronDownloading || nemotronDownload?.status === "downloading"
    $: if (nemotronDownload?.status === "complete" && status && !status.nemotron.ready) getStatus()

    // CUSTOM BINARY PATH

    let customPathValid = false
    let customPathError = false
    async function verifyCustomPath(path: string) {
        customPathError = false

        if (!path) {
            customPathValid = false
            update("whisperCustomPath", "")
            return
        }

        const result = await requestMain(Main.AI_SCRIPTURE_WHISPER_VERIFY_PATH, { path })
        if (result?.valid) {
            customPathValid = true
            update("whisperCustomPath", path)
        } else {
            customPathValid = false
            customPathError = true
        }
    }

    const BREW_COMMAND = "brew install whisper-cpp"
    let commandCopied = false
    function copyBrewCommand() {
        navigator.clipboard.writeText(BREW_COMMAND)
        commandCopied = true
        setTimeout(() => (commandCopied = false), 2000)
    }

    // DETECTION (AI)

    const providerOptions = [
        { value: "anthropic", label: "Anthropic (Claude)" },
        { value: "openai", label: "OpenAI (GPT)" },
        { value: "gemini", label: "Google (Gemini)" },
        { value: "ollama", label: "Local (Ollama - Gemma)" }
    ]

    $: provider = ((settings.provider as string) || "anthropic") as AIProviderId
    $: providerData = AI_PROVIDER_MODELS[provider]
    $: modelOptions = providerData.models.map((model) => ({ value: model.id, label: model.name }))
    $: storedModel = ((settings.models?.[provider] as string) || (settings.model as string) || "") as string // "models" is stored per provider - "model" is the legacy shared value
    $: selectedModel = providerData.models.find((model) => model.id === storedModel) ? storedModel : providerData.defaultModel
    $: effectiveModel = (settings.customModel as string) || selectedModel
    $: keySaved = !!status?.keys[provider]

    function setProvider(id: string) {
        update("provider", id)
        keyInput = ""
        testResult = null
    }

    function setModel(id: string) {
        update("models", { ...(settings.models || {}), [provider]: id })
    }

    let keyInput = ""
    function saveKey() {
        if (!keyInput) return

        sendMain(Main.AI_SCRIPTURE_SET_KEY, { provider, key: keyInput })
        keyInput = ""
        testResult = null
        setTimeout(getStatus, 200)
    }

    function removeKey() {
        sendMain(Main.AI_SCRIPTURE_SET_KEY, { provider, key: "" })
        testResult = null
        setTimeout(getStatus, 200)
    }

    // local ollama needs no API key - just the selected model pulled
    $: ollamaPullCommand = `ollama pull ${effectiveModel}`
    let ollamaCommandCopied = false
    function copyOllamaCommand() {
        navigator.clipboard.writeText(ollamaPullCommand)
        ollamaCommandCopied = true
        setTimeout(() => (ollamaCommandCopied = false), 2000)
    }

    let testing = false
    let testResult: { ok: boolean; error?: AIError } | null = null
    async function testConnection() {
        if (testing) return
        testing = true
        testResult = null

        testResult = (await requestMain(Main.AI_SCRIPTURE_TEST_CONNECTION, { provider, model: effectiveModel }, undefined, 60000)) || { ok: false, error: { code: "timeout" } }
        testing = false
    }

    let showCustomModel = !!$special.aiScripture?.customModel
    function toggleCustomModel(enabled: boolean) {
        showCustomModel = enabled
        if (!enabled) update("customModel", "")
    }

    // SEARCH BIBLES

    $: bibleList = sortByName(keysToID($scriptures).map((bible) => ({ ...bible, name: bible.customName || bible.name })))
    $: searchBibles = ((settings.searchBibles as string[]) || []) as string[]

    function toggleBible(id: string, checked: boolean) {
        const list = searchBibles.filter((bibleId) => bibleId !== id)
        if (checked) list.push(id)
        update("searchBibles", list)
    }

    const displayTranslationOptions = [
        { value: "drawer", label: translateText("settings.ai_display_drawer") },
        { value: "matched", label: translateText("settings.ai_display_matched") }
    ]

    // BEHAVIOR

    const modeOptions = [
        { value: "confirm", label: translateText("settings.ai_mode_confirm") },
        { value: "auto", label: translateText("settings.ai_mode_auto") }
    ]
    // stop any active listening session when the feature is turned off (the drawer panel unmounts with it)
    function toggleEnabled(e: any) {
        const enabled = !!e.detail
        if (!enabled) stopAiScriptureListening()
        update("enabled", enabled)
    }
</script>

<MaterialToggleSwitch label="settings.ai_scripture_enable" checked={settings.enabled || false} defaultValue={false} on:change={toggleEnabled} />

{#if !settings.enabled}
    <p class="faded" style="padding: 10px 5px;"><T id="settings.ai_scripture_privacy" /></p>
{:else}
    <Title label="settings.ai_transcription" icon="microphone" />

    <MaterialDropdown label="settings.ai_engine" options={engineOptions} value={engine} defaultValue="whisper" on:change={(e) => update("engine", e.detail)} />
    <p class="faded hint"><T id={engine === "nemotron" ? "settings.ai_engine_nemotron_hint" : "settings.ai_engine_whisper_hint"} /></p>

    {#if engine === "nemotron"}
        {#if !status}
            <div class="loading"><Loader /></div>
        {:else if !status.nemotron.supported}
            <Tip type="warning" value="settings.ai_nemotron_unsupported" />
            {#if status.nemotron.ready}
                <!-- the model was downloaded before the addon became unavailable - 660 MB must stay reclaimable -->
                <MaterialButton variant="outlined" icon="delete" on:click={deleteNemotronModel}>
                    <T id="settings.ai_nemotron_delete" />
                </MaterialButton>
            {/if}
        {:else if status.nemotron.ready}
            <div class="statusLine ok">
                <Icon id="check" size={0.9} white />
                <T id="settings.ai_nemotron_ready" />
            </div>
            <MaterialButton variant="outlined" icon="delete" on:click={deleteNemotronModel}>
                <T id="settings.ai_nemotron_delete" />
            </MaterialButton>
        {:else if nemotronActive}
            <div class="progressArea">
                <div class="progressBar"><div class="progressFill" style="width: {getPercent(nemotronDownload)}%;" /></div>
                <span class="percentLabel">{getPercent(nemotronDownload)}%</span>
                <MaterialButton icon="close" title="popup.cancel" on:click={cancelNemotronDownload} />
            </div>
        {:else}
            <div class="installArea">
                <p class="faded"><T id="settings.ai_nemotron_not_downloaded" /></p>
                <MaterialButton variant="outlined" icon="download" on:click={downloadNemotron}>
                    <T id="settings.ai_download_nemotron" />
                </MaterialButton>
            </div>
        {/if}

        {#if nemotronError || (!nemotronActive && nemotronDownload?.status === "error")}
            <Tip type="warning" value={aiScriptureErrorText(nemotronError || nemotronDownload?.message || "start_failed")} />
        {/if}
    {:else if !status}
        <div class="loading"><Loader /></div>
    {:else if binaryInstalled}
        <div class="statusLine ok">
            <Icon id="check" size={0.9} white />
            <T id="settings.ai_whisper_installed" />
            {#if settings.whisperCustomPath || status.whisper.binaryPath}
                <span class="path">{settings.whisperCustomPath || status.whisper.binaryPath}</span>
            {/if}
        </div>
    {:else}
        <div class="installArea">
            <p class="faded"><T id="settings.ai_whisper_not_installed" /></p>

            {#if platform === "win32"}
                {#if binaryActive}
                    <div class="progressArea">
                        <div class="progressBar"><div class="progressFill" style="width: {getPercent(binaryDownload)}%;" /></div>
                        <span class="percentLabel">{getPercent(binaryDownload)}%</span>
                        <MaterialButton icon="close" title="popup.cancel" on:click={cancelDownload} />
                    </div>
                {:else}
                    <MaterialButton variant="outlined" icon="download" on:click={downloadBinary}>
                        <T id="settings.ai_download_whisper" />
                    </MaterialButton>
                {/if}

                {#if binaryError}
                    <Tip type="warning" value={aiScriptureErrorText(binaryError)} />
                {/if}
            {:else if platform === "darwin"}
                <p class="faded"><T id="settings.ai_whisper_mac_guide" /></p>
                <div class="commandRow">
                    <code>{BREW_COMMAND}</code>
                    <MaterialButton icon={commandCopied ? "check" : "copy"} title={commandCopied ? "actions.copied" : "actions.copy"} on:click={copyBrewCommand} />
                </div>
                <MaterialButton variant="outlined" icon="refresh" on:click={getStatus}>
                    <T id="settings.ai_check_again" />
                </MaterialButton>
            {:else}
                <p class="faded"><T id="settings.ai_whisper_linux_guide" /></p>
                <MaterialButton variant="outlined" icon="refresh" on:click={getStatus}>
                    <T id="settings.ai_check_again" />
                </MaterialButton>
            {/if}
        </div>
    {/if}

    {#if engine === "whisper" && status && (!binaryInstalled || settings.whisperCustomPath || platform === "linux")}
        <MaterialFilePicker label="settings.ai_whisper_custom_path" value={settings.whisperCustomPath || ""} filter={{ name: "whisper-cli", extensions: ["*"] }} icon="folder" allowEmpty on:change={(e) => verifyCustomPath(e.detail || "")} />
        {#if customPathError}
            <Tip type="warning" value="settings.ai_whisper_path_invalid" />
        {/if}
    {/if}

    {#if engine === "whisper"}
        <!-- use an already installed ggml model file (e.g. large-v3) instead of downloading one -->
        <MaterialFilePicker label="settings.ai_whisper_custom_model" value={settings.whisperCustomModelPath || ""} filter={{ name: "ggml model", extensions: ["bin"] }} icon="folder" allowEmpty on:change={(e) => update("whisperCustomModelPath", e.detail || "")} />

        <InputRow>
            <MaterialDropdown label="settings.ai_whisper_model" options={whisperModelOptions} value={whisperModelBase} defaultValue="base" on:change={(e) => setWhisperModel(e.detail)} />

            {#if status}
                {#if modelDownloaded}
                    <div class="statusLine ok inline">
                        <Icon id="check" size={0.9} white />
                        <T id="settings.ai_model_downloaded" />
                    </div>
                {:else if modelActive}
                    <div class="progressArea">
                        <div class="progressBar"><div class="progressFill" style="width: {getPercent(modelDownload)}%;" /></div>
                        <span class="percentLabel">{getPercent(modelDownload)}%</span>
                        <MaterialButton icon="close" title="popup.cancel" on:click={cancelDownload} />
                    </div>
                {:else}
                    <MaterialButton icon="download" on:click={downloadModel}>
                        <T id="settings.ai_download_model" />
                    </MaterialButton>
                {/if}
            {/if}
        </InputRow>
        {#if modelError || (!modelActive && modelDownload?.status === "error")}
            <Tip type="warning" value={aiScriptureErrorText(modelError || modelDownload?.message || "start_failed")} />
        {/if}
    {/if}

    <InputRow>
        <MaterialDropdown label="live.microphones" options={microphones} value={settings.micDeviceId || ""} on:change={(e) => update("micDeviceId", e.detail)} allowEmpty />
        {#if engine === "whisper"}
            <MaterialDropdown label="settings.ai_spoken_language" options={languageOptions} value={spokenLanguage} defaultValue={($language || "en").slice(0, 2).toLowerCase()} on:change={(e) => setSpokenLanguage(e.detail)} />
        {/if}
    </InputRow>

    {#if engine === "whisper"}
        <MaterialToggleSwitch label="settings.ai_interpretation" checked={settings.interpretationMode === true} defaultValue={false} on:change={(e) => toggleInterpretation(e.detail)} />
        {#if interpretationMode}
            <p class="faded hint"><T id="settings.ai_interpretation_hint" /></p>

            <p class="listLabel"><T id="settings.ai_spoken_languages" /> ({spokenLanguages.length})</p>
            <div class="languageList">
                {#each WHISPER_LANGUAGES as spoken}
                    <MaterialCheckbox label={spoken.name} checked={spokenLanguages.includes(spoken.code)} on:change={(e) => toggleSpokenLanguage(spoken.code, e.detail)} />
                {/each}
            </div>
            <p class="faded hint"><T id="settings.ai_spoken_languages_hint" /></p>

            <MaterialDropdown label="settings.ai_listen_language" options={listenLanguageOptions} value={listenLanguage} defaultValue={spokenLanguage} on:change={(e) => update("listenLanguage", e.detail)} />
            <p class="faded hint"><T id="settings.ai_interpretation_model_hint" /></p>
        {/if}
    {/if}

    <Title label="settings.ai_detection" icon="search" />

    <MaterialDropdown label="settings.ai_provider" options={providerOptions} value={provider} defaultValue="anthropic" on:change={(e) => setProvider(e.detail)} />

    {#if provider === "ollama"}
        <!-- no API key: everything runs on the local ollama server - just make sure the model is pulled -->
        <p class="faded hint"><T id="settings.ai_ollama_hint" /></p>
        <div class="commandRow">
            <code>{ollamaPullCommand}</code>
            <MaterialButton icon={ollamaCommandCopied ? "check" : "copy"} title={ollamaCommandCopied ? "actions.copied" : "actions.copy"} on:click={copyOllamaCommand} />
        </div>
        <MaterialButton variant="outlined" icon="connection" disabled={testing} on:click={testConnection}>
            <T id="settings.ai_test_connection" />
        </MaterialButton>
    {:else}
        <InputRow>
            <MaterialTextInput label="settings.ai_api_key" value={keyInput} type="password" pasteBtn on:input={(e) => (keyInput = e.detail)} />
            <MaterialButton icon="save" disabled={!keyInput} on:click={saveKey}>
                <T id="actions.save" />
            </MaterialButton>
            <MaterialButton icon="connection" disabled={(!keySaved && !keyInput) || testing} on:click={testConnection}>
                <T id="settings.ai_test_connection" />
            </MaterialButton>
            {#if keySaved}
                <MaterialButton icon="delete" title="settings.ai_remove_key" on:click={removeKey} />
            {/if}
        </InputRow>

        {#if keySaved && !testResult}
            <div class="statusLine ok">
                <Icon id="check" size={0.9} white />
                <T id="settings.ai_key_saved" />
            </div>
        {/if}
    {/if}

    {#if testing}
        <div class="statusLine"><Loader /></div>
    {:else if testResult}
        {#if testResult.ok}
            <div class="statusLine ok">
                <Icon id="check" size={0.9} white />
                <T id="settings.ai_test_success" />
            </div>
        {:else}
            <div class="statusLine error">
                <Icon id="warning" size={0.9} white />
                <T id="settings.ai_error_{testResult.error?.code || 'network'}" />
                {#if testResult.error?.message}
                    <span class="path">{testResult.error.message}</span>
                {/if}
            </div>
        {/if}
    {/if}

    <MaterialDropdown label="settings.ai_model" options={modelOptions} value={selectedModel} defaultValue={providerData.defaultModel} disabled={showCustomModel} on:change={(e) => setModel(e.detail)} />

    <MaterialToggleSwitch label="settings.ai_custom_model" checked={showCustomModel} defaultValue={false} on:change={(e) => toggleCustomModel(e.detail)} />
    {#if showCustomModel}
        <MaterialTextInput label="settings.ai_custom_model_id" value={settings.customModel || ""} on:change={(e) => update("customModel", e.detail)} />
    {/if}

    <Title label="settings.ai_search_bibles ({searchBibles.length})" icon="scripture" />

    {#if bibleList.length}
        <InputRow>
            <MaterialButton
                style="flex: 1;"
                icon="check"
                on:click={() =>
                    update(
                        "searchBibles",
                        bibleList.map((bible) => bible.id)
                    )}
            >
                <T id="settings.ai_select_all" />
            </MaterialButton>
            <MaterialButton style="flex: 1;" icon="disable" on:click={() => update("searchBibles", [])}>
                <T id="settings.ai_deselect_all" />
            </MaterialButton>
        </InputRow>

        <div class="bibleList">
            {#each bibleList as bible}
                <MaterialCheckbox label={bible.name} checked={searchBibles.includes(bible.id)} on:change={(e) => toggleBible(bible.id, e.detail)} />
            {/each}
        </div>
    {:else}
        <p class="faded"><T id="empty.general" /></p>
    {/if}

    <MaterialDropdown label="settings.ai_display_translation" options={displayTranslationOptions} value={settings.displayTranslation || "drawer"} defaultValue="drawer" on:change={(e) => update("displayTranslation", e.detail)} />

    <Title label="settings.ai_behavior" icon="options" />

    <MaterialDropdown label="settings.ai_mode" options={modeOptions} value={settings.mode || "confirm"} defaultValue="confirm" on:change={(e) => update("mode", e.detail)} />
    {#if (settings.mode || "confirm") === "auto"}
        <Tip type="warning" value="settings.ai_mode_auto_warning" top={10} />
    {/if}

    <MaterialToggleSwitch label="settings.ai_auto_project_quoted" checked={settings.autoProjectQuoted === true} defaultValue={false} on:change={(e) => update("autoProjectQuoted", e.detail)} />
    <p class="faded hint"><T id="settings.ai_auto_project_quoted_hint" /></p>

    <MaterialToggleSwitch label="settings.ai_voice_commands" checked={settings.voiceCommands === true} defaultValue={false} on:change={(e) => update("voiceCommands", e.detail)} />
    {#if settings.voiceCommands}
        <p class="faded"><T id="settings.ai_voice_commands_hint" /></p>
    {/if}

    <InputRow>
        <MaterialNumberInput label="settings.ai_auto_cooldown" value={Number(settings.autoCooldownSeconds ?? 10)} defaultValue={10} min={0} max={300} on:change={(e) => update("autoCooldownSeconds", e.detail)} />
        <MaterialNumberInput label="settings.ai_ref_cooldown" value={Number(settings.refCooldownSeconds ?? 90)} defaultValue={90} min={0} max={600} on:change={(e) => update("refCooldownSeconds", e.detail)} />
        <MaterialNumberInput label="settings.ai_max_verses" value={Number(settings.maxVerses ?? 6)} defaultValue={6} min={1} max={20} on:change={(e) => update("maxVerses", e.detail)} />
    </InputRow>

    <div class="privacy">
        <div class="privacyTitle">
            <Icon id="info" size={1.1} white />
            <T id="settings.ai_privacy" />
        </div>
        <p><T id="settings.ai_privacy_local" /></p>
        <p><T id="settings.ai_privacy_llm" /></p>
        <p><T id="settings.ai_privacy_keys" /></p>
    </div>
{/if}

<style>
    .loading {
        display: flex;
        justify-content: center;
        padding: 10px;
    }

    .faded {
        opacity: 0.6;
        font-size: 0.85em;
        white-space: initial;
    }
    .hint {
        padding: 5px 10px 10px;
    }

    .installArea {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 5px 0;
    }

    .statusLine {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 10px;
        font-size: 0.8em;
    }
    .statusLine.inline {
        white-space: nowrap;
    }
    .statusLine.ok {
        color: #6fdc6f;
    }
    .statusLine.error {
        color: #ff9090;
    }
    .statusLine .path {
        opacity: 0.5;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .commandRow {
        display: flex;
        align-items: center;
        gap: 5px;
    }
    .commandRow code {
        flex: 1;
        background-color: var(--primary-darkest);
        padding: 8px 12px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 0.85em;
    }

    .progressArea {
        display: flex;
        align-items: center;
        gap: 5px;
        flex: 1;
        padding: 0 5px;
    }
    .progressBar {
        flex: 1;
        height: 6px;
        border-radius: 3px;
        background-color: var(--primary-darkest);
        overflow: hidden;
    }
    .percentLabel {
        font-size: 0.75em;
        opacity: 0.8;
        min-width: 34px;
        text-align: end;
    }
    .progressFill {
        height: 100%;
        background-color: var(--secondary);
        transition: width 0.2s ease;
    }

    .bibleList,
    .languageList {
        display: flex;
        flex-direction: column;
        max-height: 200px;
        overflow-y: auto;
        background-color: var(--primary-darker);
        border-radius: 4px;
    }
    .languageList {
        max-height: 150px;
    }

    .listLabel {
        font-size: 0.8em;
        opacity: 0.8;
        padding: 5px 10px 2px;
    }

    .privacy {
        margin-top: 25px;
        padding: 12px 15px;
        background-color: var(--primary-darker);
        border-radius: 6px;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .privacyTitle {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        text-transform: uppercase;
        font-size: 0.8em;
    }
    .privacy p {
        font-size: 0.75em;
        opacity: 0.7;
        white-space: initial;
    }
</style>
