<script lang="ts">
    import type { AIProviderId, EngineStatus } from "../../../../types/ai/Ai"
    import { Main } from "../../../../types/IPC/Main"
    import MaterialDropdown from "../../../components/inputs/MaterialDropdown.svelte"
    import MaterialTextInput from "../../../components/inputs/MaterialTextInput.svelte"
    import Loader from "../../../components/main/Loader.svelte"
    import Tip from "../../../components/main/Tip.svelte"
    import { requestMain } from "../../../IPC/main"
    import { ai } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { translateText } from "../../../utils/language"
    import { llmSession } from "../../llm/llmSession"

    $: llmOptions = $ai.llm || {}

    function updateLlmOption(key: string, value: any) {
        ai.update((a) => {
            if (!a.llm) a.llm = {}
            a.llm[key] = value
            return a
        })
    }

    const providerOptions = [
        { value: "none", label: translateText("main.none") },
        { value: "ollama", label: "Local - Ollama" },
        { value: "anthropic", label: "Anthropic (Claude)" },
        { value: "openai", label: "OpenAI (GPT)" },
        { value: "google", label: "Google (Gemini)" }
    ]

    $: provider = (llmOptions.provider || "none") as AIProviderId | "none"

    // DYNAMIC MODEL FETCHING
    let fetchedModels: { id: string; name: string }[] = []
    let loadingModels = false

    $: if (provider && provider !== "none") fetchModelsForProvider(provider)
    else fetchedModels = []

    async function fetchModelsForProvider(currentProvider: AIProviderId) {
        loadingModels = true
        try {
            const result = await requestMain(Main.AI_GET_MODELS, { providerId: currentProvider })
            if (result && Array.isArray(result) && result.length > 0) {
                fetchedModels = result
            } else {
                fetchedModels = []
            }
        } catch (e) {
            fetchedModels = []
        } finally {
            loadingModels = false
        }
    }

    $: activeModelList = fetchedModels.length > 0 ? fetchedModels : []

    $: modelOptions = activeModelList.map((model) => ({ value: model.id, label: model.name }))
    $: storedModel = llmOptions.model || ""
    $: defaultModel = activeModelList[0]?.id || ""
    $: selectedModel = activeModelList.find((model) => model.id === storedModel) ? storedModel : defaultModel

    function setProvider(id: string) {
        updateLlmOption("provider", id)
        updateLlmOption("model", "")
        keyInput = ""
    }

    // STATUS

    let status: { [key: string]: EngineStatus } | null = null
    $: if (provider) getStatus()
    async function getStatus() {
        if (!provider || provider === "none") return
        if (!storedModel) return

        const result = await requestMain(Main.AI_GET_STATUS, { engineId: provider })
        status = result || null
        if (status?.[provider]?.error) newToast(status?.[provider]?.error)
    }

    // API KEY

    let keyInput = ""
    function updateKey(e: any) {
        keyInput = e.detail

        saveKey()
    }

    async function saveKey() {
        if (!keyInput || provider === "none" || provider === "ollama") return

        const isValid = await requestMain(Main.AI_SET_KEY, { providerId: provider, key: keyInput })
        if (!isValid) {
            keyInput = ""
            newToast("Invalid key")
            return
        }

        getStatus()
        llmSession.refreshConfig()
        fetchModelsForProvider(provider)
    }
</script>

<MaterialDropdown label="ai.provider" options={providerOptions} value={provider} on:change={(e) => setProvider(e.detail)} />

{#if provider === "none"}
    <!-- explicitly no LLM - detection runs on speech-to-text alone -->
{:else if provider === "ollama"}
    <!-- no API key: everything runs on the local ollama server - just make sure the model is pulled -->
{:else}
    <Tip type="warning" value="ai.privacy_cloud" top={10} bottom={10} />

    <MaterialTextInput label="ai.api_key" value={keyInput} type="password" pasteBtn on:change={updateKey} />
{/if}

{#if provider !== "none"}
    <div class="modelSelectRow">
        <MaterialDropdown label="ai.model" options={modelOptions} value={selectedModel} defaultValue={defaultModel} disabled={loadingModels || !!status?.[provider]?.error} on:change={(e) => updateLlmOption("model", e.detail)} />

        {#if loadingModels}
            <span class="inlineLoader"><Loader size={0.9} /></span>
        {/if}
    </div>
{/if}

<style>
    .modelSelectRow {
        position: relative;
        display: flex;
        align-items: center;
    }
    .inlineLoader {
        position: absolute;
        right: 10px;
    }
</style>
