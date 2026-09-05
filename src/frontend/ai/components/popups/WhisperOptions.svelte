<script lang="ts">
    import { onMount } from "svelte"
    import type { EngineStatus } from "../../../../types/ai/Ai"
    import { Main } from "../../../../types/IPC/Main"
    import T from "../../../components/helpers/T.svelte"
    import InputRow from "../../../components/input/InputRow.svelte"
    import MaterialButton from "../../../components/inputs/MaterialButton.svelte"
    import MaterialCheckbox from "../../../components/inputs/MaterialCheckbox.svelte"
    import MaterialDropdown from "../../../components/inputs/MaterialDropdown.svelte"
    import MaterialFilePicker from "../../../components/inputs/MaterialFilePicker.svelte"
    import MaterialToggleSwitch from "../../../components/inputs/MaterialToggleSwitch.svelte"
    import Loader from "../../../components/main/Loader.svelte"
    import Tip from "../../../components/main/Tip.svelte"
    import { requestMain, sendMain } from "../../../IPC/main"
    import { ai, mediaDownloads, os } from "../../../stores"
    import { customLanguageModels, WHISPER_LANGUAGES, whisperModels } from "../../stt/whisperData"

    const engine = "whisper"

    $: options = $ai.stt || {}
    $: engineOptions = options.engineOptions?.[engine] || {}

    function updateEngineOption(key: string, value: any) {
        ai.update((a) => {
            if (!a.stt) a.stt = {}
            if (!a.stt.engineOptions) a.stt.engineOptions = {}
            if (!a.stt.engineOptions[engine]) a.stt.engineOptions[engine] = {}
            a.stt.engineOptions[engine][key] = value
            return a
        })
    }

    // STATUS

    let status: EngineStatus | null = null
    async function getStatus() {
        const result = await requestMain(Main.AI_GET_STATUS, { engineId: engine, customPath: engineOptions.customPath || undefined })
        status = result?.[engine] || null
    }

    onMount(() => {
        getStatus()

        if (engineOptions.customPath) verifyCustomPath(engineOptions.customPath)
    })

    $: platform = $os.platform

    // TRANSCRIPTION

    const languageOptions = WHISPER_LANGUAGES.map((a) => ({ value: a.code, label: a.name }))

    $: spokenLanguage = engineOptions.language || "en"
    $: interpretationMode = engineOptions.interpretationMode === true

    $: modelIdTrimmed = trimModelId(engineOptions.model || "base")
    $: modelId = getModelId(modelIdTrimmed, spokenLanguage, interpretationMode)

    function trimModelId(model: string) {
        const index = model.indexOf(".")
        return index === -1 ? model : model.substring(0, index)
    }
    function getModelId(model: string, language: string, _updater: any = null) {
        model = trimModelId(model)

        // interpretation mode auto-detects the language per window - that needs a multilingual model, never an .en variant
        if (interpretationMode) return model

        const hasCustomModels = customLanguageModels[language]?.some((a) => a === model)
        return hasCustomModels ? `${model}.${language}` : model
    }

    function setWhisperModel(base: string) {
        const modelId = getModelId(base, spokenLanguage)
        updateEngineOption("model", modelId)
    }

    function setSpokenLanguage(code: string) {
        updateEngineOption("language", code)
        setWhisperModel(modelIdTrimmed)
    }

    function toggleInterpretation(enabled: boolean) {
        updateEngineOption("interpretationMode", enabled)
        setWhisperModel(modelIdTrimmed)
    }

    // LANGUAGES SPOKEN (interpretation mode)
    // the declared set constrains whisper's per-window language guess - default: the speaker & detection languages

    $: listenLanguage = ((engineOptions.listenLanguage as string) || spokenLanguage) as string
    $: spokenLanguages = ((engineOptions.spokenLanguages as string[]) || Array.from(new Set([spokenLanguage, listenLanguage]))) as string[]

    function toggleSpokenLanguage(code: string, checked: boolean) {
        const list = spokenLanguages.filter((languageCode) => languageCode !== code)
        if (checked) list.push(code)
        updateEngineOption("spokenLanguages", list)
    }

    // scripture detection can only listen to a language that is actually spoken - full list until a real set is picked
    $: listenLanguageOptions = spokenLanguages.length >= 2 ? languageOptions.filter((option) => spokenLanguages.includes(option.value)) : languageOptions

    // DOWNLOADS

    // download progress is keyed by the electron DownloadManager: "whisper" for the binary, the model id for models
    $: engineDownload = $mediaDownloads.get("whisper")
    $: modelDownload = $mediaDownloads.get(modelId)

    $: isEngineDownloaded = status?.ready
    $: isEngineDownloading = engineDownloadStarted || engineDownload?.status === "downloading"

    $: isModelDownloaded = status?.downloadedModels?.includes(modelId)
    $: isModelDownloading = modelDownloadStarted || modelDownload?.status === "downloading"

    function getPercent(download: { progress: number; total: number } | undefined) {
        if (!download?.total) return ""
        return ` ${Math.min(100, Math.floor((download.progress / download.total) * 100))}%`
    }

    let engineDownloadStarted = false
    async function downloadEngine() {
        if (isEngineDownloading) return
        engineDownloadStarted = true

        await requestMain(Main.AI_SETUP, { action: "download", engineId: "whisper" }, undefined, 60 * 60 * 1000)
        engineDownloadStarted = false

        getStatus()
    }

    let modelDownloadStarted = false
    async function downloadModel() {
        if (isModelDownloading) return
        modelDownloadStarted = true

        await requestMain(Main.AI_SETUP, { action: "download", engineId: "whisper", modelId }, undefined, 60 * 60 * 1000)
        modelDownloadStarted = false

        getStatus()
    }

    function cancelDownload() {
        sendMain(Main.AI_SETUP, { action: "cancel", engineId: "whisper", modelId: modelDownload ? modelId : undefined })
        engineDownloadStarted = false
        modelDownloadStarted = false
    }

    // CUSTOM BINARY PATH

    async function verifyCustomPath(path: string) {
        if (!path) {
            updateEngineOption("customPath", "")
            return
        }

        const valid = await requestMain(Main.AI_SETUP, { action: "verify", engineId: "whisper", customPath: path })
        if (valid) updateEngineOption("customPath", path)
        getStatus()
    }

    const BREW_COMMAND = "brew install whisper-cpp"
    let commandCopied = false
    function copyBrewCommand() {
        navigator.clipboard.writeText(BREW_COMMAND)
        commandCopied = true
        setTimeout(() => (commandCopied = false), 2000)
    }
</script>

{#if !status}
    <div style="display: flex;justify-content: center;padding: 10px;">
        <Loader />
    </div>
{:else if !isEngineDownloaded}
    <!-- TODO: eventually I would like a dedicated docs section for this on the website instead -->

    {#if platform === "win32"}
        <InputRow>
            <MaterialButton variant="outlined" icon="download" disabled={isEngineDownloading} style="flex: 1;" on:click={downloadEngine}>
                <T id="cloud.replace" />{getPercent(engineDownload)}
            </MaterialButton>

            {#if isEngineDownloading}
                <MaterialButton variant="outlined" icon="close" title="actions.cancel" on:click={cancelDownload} />
            {/if}

            <MaterialFilePicker label="" title="inputs.custom_path" value={engineOptions.customPath || ""} filter={{ name: "whisper-cli", extensions: ["*"] }} icon="folder" style="width: initial;padding: 0 8px;" on:change={(e) => verifyCustomPath(e.detail || "")} noLabel allowEmpty />
        </InputRow>
    {:else if platform === "darwin"}
        <InputRow>
            <Tip type="info" value="ai.whisper_mac_guide" style="padding: 6px;flex: 1;" />

            <MaterialFilePicker label="" title="inputs.custom_path" value={engineOptions.customPath || ""} filter={{ name: "whisper-cli", extensions: ["*"] }} icon="folder" style="width: initial;padding: 0 8px;" on:change={(e) => verifyCustomPath(e.detail || "")} noLabel allowEmpty />

            <MaterialButton variant="outlined" icon="refresh" title="ai.check_again" on:click={getStatus} />
        </InputRow>

        <InputRow>
            <code>{BREW_COMMAND}</code>
            <MaterialButton variant="outlined" icon={commandCopied ? "check" : "copy"} title={commandCopied ? "actions.copied" : "actions.copy"} on:click={copyBrewCommand} />
        </InputRow>
    {:else}
        <InputRow>
            <Tip type="info" value="ai.whisper_linux_guide" style="padding: 6px;flex: 1;" />
            <MaterialButton variant="outlined" icon="refresh" title="ai.check_again" on:click={getStatus} />
        </InputRow>

        <MaterialFilePicker label="inputs.custom_path" value={engineOptions.customPath || ""} filter={{ name: "whisper-cli", extensions: ["*"] }} icon="folder" on:change={(e) => verifyCustomPath(e.detail || "")} allowEmpty />
    {/if}
{:else}
    {#if engineOptions.customPath}
        <MaterialFilePicker label="inputs.custom_path" value={engineOptions.customPath || ""} filter={{ name: "whisper-cli", extensions: ["*"] }} icon="folder" on:change={(e) => verifyCustomPath(e.detail || "")} allowEmpty />
    {/if}

    <InputRow>
        <MaterialDropdown label="captions.language" options={languageOptions} value={spokenLanguage} on:change={(e) => setSpokenLanguage(e.detail)} />

        <MaterialDropdown label="ai.model" options={whisperModels} value={modelIdTrimmed} on:change={(e) => setWhisperModel(e.detail)} />
    </InputRow>

    {#if !isModelDownloaded || engineOptions.customModelPath}
        <InputRow>
            {#if isModelDownloaded}
                <!-- use an already installed ggml model file (e.g. large-v3) instead of downloading one -->
                <MaterialFilePicker label="inputs.custom_path" value={engineOptions.customModelPath || ""} filter={{ name: "ggml model", extensions: ["bin"] }} icon="folder" on:change={(e) => updateEngineOption("customModelPath", e.detail || "")} allowEmpty />
            {:else}
                <MaterialButton icon="download" disabled={isModelDownloading} style="flex: 1;" on:click={downloadModel}>
                    <T id="cloud.replace" />{getPercent(modelDownload)}
                </MaterialButton>

                {#if isModelDownloading}
                    <MaterialButton variant="outlined" icon="close" title="actions.cancel" on:click={cancelDownload} />
                {/if}

                <MaterialFilePicker label="" title="inputs.custom_path" value={engineOptions.customModelPath || ""} filter={{ name: "ggml model", extensions: ["bin"] }} icon="folder" style="width: initial;padding: 0 8px;" on:change={(e) => updateEngineOption("customModelPath", e.detail || "")} noLabel allowEmpty />
            {/if}
        </InputRow>
    {/if}

    <!-- WIP interpretation -->
    <InputRow style="margin-top: 10px;" arrow={interpretationMode}>
        <MaterialToggleSwitch label="ai.interpretation" checked={engineOptions.interpretationMode === true} defaultValue={false} style="width: 100%;" on:change={(e) => toggleInterpretation(e.detail)} />

        <svelte:fragment slot="menu">
            <p class="faded hint"><T id="ai.interpretation_hint" /></p>

            <p class="listLabel"><T id="captions.language" /> ({spokenLanguages.length})</p>
            <div class="languageList">
                {#each WHISPER_LANGUAGES as spoken}
                    <MaterialCheckbox label={spoken.name} checked={spokenLanguages.includes(spoken.code)} on:change={(e) => toggleSpokenLanguage(spoken.code, e.detail)} />
                {/each}
            </div>
            <p class="faded hint"><T id="ai.spoken_languages_hint" /></p>

            <MaterialDropdown label="ai.listen_language" options={listenLanguageOptions} value={listenLanguage} defaultValue={spokenLanguage} on:change={(e) => updateEngineOption("listenLanguage", e.detail)} />
            <p class="faded hint"><T id="ai.interpretation_model_hint" /></p>
        </svelte:fragment>
    </InputRow>
{/if}

<style>
    .faded {
        opacity: 0.6;
        font-size: 0.85em;
        white-space: initial;
        padding: 5px 8px;
    }

    code {
        display: flex;
        align-items: center;
        flex: 1;

        background-color: var(--primary-darkest);
        background-color: black;
        color: white;
        user-select: text;

        padding: 8px 12px;
        border-radius: 6px;
        font-family: monospace;
        letter-spacing: 0.5px;
        font-size: 0.9em;
    }

    .languageList {
        max-height: 200px;
        overflow: auto;
    }
</style>
