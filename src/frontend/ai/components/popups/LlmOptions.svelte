<script lang="ts">
    import type { EngineStatus } from "../../../../types/ai/Ai"
    import { Main } from "../../../../types/IPC/Main"
    import Icon from "../../../components/helpers/Icon.svelte"
    import T from "../../../components/helpers/T.svelte"
    import InputRow from "../../../components/input/InputRow.svelte"
    import MaterialButton from "../../../components/inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../../components/inputs/MaterialDropdown.svelte"
    import MaterialTextInput from "../../../components/inputs/MaterialTextInput.svelte"
    import Loader from "../../../components/main/Loader.svelte"
    import Tip from "../../../components/main/Tip.svelte"
    import { requestMain, sendMain } from "../../../IPC/main"
    import { ai } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { llmSession } from "../../llm/llmSession"
    import { AI_PROVIDER_MODELS, type AIProviderId } from "../../llm/llmModels"

    $: llmOptions = $ai.llm || {}

    function updateLlmOption(key: string, value: any) {
        ai.update((a) => {
            if (!a.llm) a.llm = {}
            a.llm[key] = value
            return a
        })
    }

    const providerOptions = [
        // explicitly no LLM: detection runs on speech-to-text alone (tier-1 references + on-device quote matching)
        { value: "none", label: translateText("main.none") },
        { value: "ollama", label: "Local (Ollama - Gemma)" },
        { value: "anthropic", label: "Anthropic (Claude)" },
        { value: "openai", label: "OpenAI (GPT)" },
        { value: "gemini", label: "Google (Gemini)" }
    ]

    $: provider = (llmOptions.provider || "none") as AIProviderId | "none"
    $: providerData = provider === "none" ? null : AI_PROVIDER_MODELS[provider]
    $: modelOptions = providerData ? providerData.models.map((model) => ({ value: model.id, label: model.name })) : []
    $: storedModel = llmOptions.model || ""
    $: selectedModel = providerData ? (providerData.models.find((model) => model.id === storedModel) ? storedModel : providerData.defaultModel) : ""

    function setProvider(id: string) {
        updateLlmOption("provider", id)
        updateLlmOption("model", "")
        keyInput = ""
        testResult = null
    }

    // STATUS (a saved key - or a reachable local server for ollama)

    let status: { [key: string]: EngineStatus } | null = null
    $: if (provider && provider !== "none") getStatus()
    async function getStatus() {
        const result = await requestMain(Main.AI_GET_STATUS, { engineId: provider })
        status = result || null
    }

    $: keySaved = !!status?.[provider]?.ready

    // API KEY

    let keyInput = ""
    function saveKey() {
        if (!keyInput || provider === "none") return

        sendMain(Main.AI_SET_KEY, { providerId: provider, key: keyInput })
        keyInput = ""
        testResult = null
        // a listening session picks the key up right away - no restart needed
        setTimeout(() => {
            getStatus()
            void llmSession.refreshConfig()
        }, 200)
    }

    function removeKey() {
        if (provider === "none") return
        sendMain(Main.AI_SET_KEY, { providerId: provider, key: "" })
        testResult = null
        setTimeout(() => {
            getStatus()
            void llmSession.refreshConfig()
        }, 200)
    }

    // local ollama needs no API key - just the selected model pulled
    $: ollamaPullCommand = `ollama pull ${selectedModel}`
    let ollamaCommandCopied = false
    function copyOllamaCommand() {
        navigator.clipboard.writeText(ollamaPullCommand)
        ollamaCommandCopied = true
        setTimeout(() => (ollamaCommandCopied = false), 2000)
    }

    let testing = false
    let testResult: { ok: boolean; error?: string } | null = null
    async function testConnection() {
        if (testing || provider === "none") return
        testing = true
        testResult = null

        testResult = (await requestMain(Main.AI_TEST_CONNECTION, { providerId: provider, model: selectedModel }, undefined, 60000)) || { ok: false, error: "Timed out" }
        testing = false
    }
</script>

<MaterialDropdown label="ai.provider" options={providerOptions} value={provider} defaultValue="none" on:change={(e) => setProvider(e.detail)} />

{#if provider === "none"}
    <!-- explicitly no LLM - detection runs on speech-to-text alone -->
{:else if provider === "ollama"}
    <!-- no API key: everything runs on the local ollama server - just make sure the model is pulled -->
    <p class="faded hint">Install Ollama from ollama.com, then download the model:</p>
    <div class="commandRow">
        <code>{ollamaPullCommand}</code>
        <MaterialButton icon={ollamaCommandCopied ? "check" : "copy"} title={ollamaCommandCopied ? "actions.copied" : "actions.copy"} on:click={copyOllamaCommand} />
    </div>
    <MaterialButton variant="outlined" icon="connection" disabled={testing} on:click={testConnection}>
        <T id="ai.test_connection" />
    </MaterialButton>
{:else}
    <Tip type="warning" value="ai.privacy_cloud" top={10} bottom={10} />

    <InputRow>
        <MaterialTextInput label="ai.api_key" value={keyInput} type="password" pasteBtn on:input={(e) => (keyInput = e.detail)} />
        <MaterialButton icon="save" disabled={!keyInput} on:click={saveKey}>
            <T id="actions.save" />
        </MaterialButton>
        <MaterialButton icon="connection" disabled={(!keySaved && !keyInput) || testing} on:click={testConnection}>
            <T id="ai.test_connection" />
        </MaterialButton>
        {#if keySaved}
            <MaterialButton icon="delete" title="ai.remove_key" on:click={removeKey} />
        {/if}
    </InputRow>

    {#if keySaved && !testResult}
        <div class="statusLine ok">
            <Icon id="check" size={0.9} white />
            <T id="ai.key_saved" />
        </div>
    {/if}
{/if}

{#if provider !== "none"}
    {#if testing}
        <div class="statusLine"><Loader /></div>
    {:else if testResult}
        {#if testResult.ok}
            <div class="statusLine ok">
                <Icon id="check" size={0.9} white />
                <T id="ai.test_success" />
            </div>
        {:else}
            <div class="statusLine error">
                <Icon id="warning" size={0.9} white />
                <T id="ai.test_failed" />
                {#if testResult.error}
                    <span class="path">{testResult.error}</span>
                {/if}
            </div>
        {/if}
    {/if}

    <MaterialDropdown label="ai.model" options={modelOptions} value={selectedModel} defaultValue={providerData?.defaultModel || ""} on:change={(e) => updateLlmOption("model", e.detail)} />
{/if}

<style>
    .faded {
        opacity: 0.6;
        font-size: 0.85em;
        white-space: initial;
    }
    .hint {
        padding: 5px 10px 10px;
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

    .statusLine {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 10px;
        font-size: 0.8em;
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
</style>
