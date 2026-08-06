<script lang="ts">
    import { onMount } from "svelte"
    import type { AIError, AIProviderId, WhisperModelId, WhisperStatus } from "../../../../types/AiScripture"
    import { AI_PROVIDER_MODELS } from "../../../../types/AiScripture"
    import { Main } from "../../../../types/IPC/Main"
    import { aiScriptureErrorText } from "../../../audio/aiScripture"
    import { AudioMicrophone } from "../../../audio/audioMicrophone"
    import { requestMain, sendMain } from "../../../IPC/main"
    import { language, os, scriptures, special, whisperDownloads } from "../../../stores"
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
    import Loader from "../Loader.svelte"
    import Tip from "../Tip.svelte"

    $: settings = ($special.aiScripture || {}) as { [key: string]: any }

    function update(key: string, value: any) {
        special.update((a) => ({ ...a, aiScripture: { ...(a.aiScripture || {}), [key]: value } }))
    }

    // STATUS

    let status: { keys: { [id in AIProviderId]: boolean }; whisper: WhisperStatus } | null = null
    async function getStatus() {
        status = (await requestMain(Main.AI_SCRIPTURE_GET_STATUS)) || null
    }

    let microphones: { value: string; label: string }[] = []
    onMount(() => {
        getStatus()

        if ($special.aiScripture?.whisperCustomPath) verifyCustomPath($special.aiScripture.whisperCustomPath)

        AudioMicrophone.getList().then((devices) => {
            microphones = devices.map((device) => ({ value: device.deviceId, label: device.label }))
        })
    })

    // TRANSCRIPTION (WHISPER)

    $: platform = $os.platform

    $: spokenLanguage = ((settings.spokenLanguage as string) || ($language || "en").slice(0, 2)).toLowerCase()
    $: englishOnly = spokenLanguage === "en"
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
        update("whisperModel", languageCode === "en" && hasEnVariant(base) ? `${base}.en` : base)
    }

    // DOWNLOADS

    type DownloadInfo = { progress: number; total: number; status: "downloading" | "complete" | "error"; message?: string }
    function getDownload(name: string, _updater: any = null): DownloadInfo | null {
        const downloads = $whisperDownloads
        if (downloads.has(name)) return downloads.get(name) || null

        let match: DownloadInfo | null = null
        downloads.forEach((value, key) => {
            if (!match && key.includes(name)) match = value
        })
        if (match) return match

        // fall back to any active download (exact key names are managed by the electron process)
        downloads.forEach((value) => {
            if (!match && value.status === "downloading") match = value
        })
        return match
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

    $: binaryDownload = binaryDownloading ? getDownload("whisper", $whisperDownloads) : null
    $: modelDownload = modelDownloading ? getDownload(whisperModelId, $whisperDownloads) : null

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
        { value: "gemini", label: "Google (Gemini)" }
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
</script>

<Title label="settings.ai_transcription" icon="microphone" />

{#if !status}
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
            {#if binaryDownloading}
                <div class="progressArea">
                    <div class="progressBar"><div class="progressFill" style="width: {getPercent(binaryDownload)}%;" /></div>
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

{#if status && (!binaryInstalled || settings.whisperCustomPath || platform === "linux")}
    <MaterialFilePicker label="settings.ai_whisper_custom_path" value={settings.whisperCustomPath || ""} filter={{ name: "whisper-cli", extensions: ["*"] }} icon="folder" allowEmpty on:change={(e) => verifyCustomPath(e.detail || "")} />
    {#if customPathError}
        <Tip type="warning" value="settings.ai_whisper_path_invalid" />
    {/if}
{/if}

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
        {:else if modelDownloading}
            <div class="progressArea">
                <div class="progressBar"><div class="progressFill" style="width: {getPercent(modelDownload)}%;" /></div>
                <MaterialButton icon="close" title="popup.cancel" on:click={cancelDownload} />
            </div>
        {:else}
            <MaterialButton icon="download" on:click={downloadModel}>
                <T id="settings.ai_download_model" />
            </MaterialButton>
        {/if}
    {/if}
</InputRow>
{#if modelError}
    <Tip type="warning" value={aiScriptureErrorText(modelError)} />
{/if}

<InputRow>
    <MaterialDropdown label="live.microphones" options={microphones} value={settings.micDeviceId || ""} on:change={(e) => update("micDeviceId", e.detail)} allowEmpty />
    <MaterialTextInput label="settings.ai_spoken_language" value={spokenLanguage} defaultValue={($language || "en").slice(0, 2).toLowerCase()} on:change={(e) => setSpokenLanguage(e.detail)} />
</InputRow>

<Title label="settings.ai_detection" icon="search" />

<MaterialDropdown label="settings.ai_provider" options={providerOptions} value={provider} defaultValue="anthropic" on:change={(e) => setProvider(e.detail)} />

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

<Title label="settings.ai_search_bibles" icon="scripture" />

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
    .progressFill {
        height: 100%;
        background-color: var(--secondary);
        transition: width 0.2s ease;
    }

    .bibleList {
        display: flex;
        flex-direction: column;
        max-height: 200px;
        overflow-y: auto;
        background-color: var(--primary-darker);
        border-radius: 4px;
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
