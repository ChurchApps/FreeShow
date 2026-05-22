<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte"
    import Button from "../../common/components/Button.svelte"
    import Icon from "../../common/components/Icon.svelte"
    import { getVoices, previewVoice, stopSpeech, ttsVoice } from "../util/tts"

    const dispatch = createEventDispatcher()

    let voices: SpeechSynthesisVoice[] = []
    let filterLang: string = ""

    onMount(() => {
        voices = getVoices()
        if (!voices.length) {
            window.speechSynthesis.addEventListener(
                "voiceschanged",
                () => {
                    voices = getVoices()
                    autoSelectLang()
                },
                { once: true }
            )
        } else {
            autoSelectLang()
        }
    })

    function autoSelectLang() {
        if (filterLang) return
        const userLang = navigator.language
        const match = voices.find((v) => v.lang === userLang) || voices.find((v) => v.lang.startsWith(userLang.split("-")[0]))
        filterLang = match?.lang || ""
        if (match && !$ttsVoice) ttsVoice.set(match)
    }

    function getLangName(lang: string): string {
        try {
            return new Intl.DisplayNames([navigator.language], { type: "language" }).of(lang) || lang
        } catch {
            return lang
        }
    }

    $: langGroups = voices.reduce(
        (acc, v) => {
            if (!acc[v.lang]) acc[v.lang] = []
            acc[v.lang].push(v)
            return acc
        },
        {} as Record<string, SpeechSynthesisVoice[]>
    )
    $: sortedLangs = Object.keys(langGroups).sort((a, b) => getLangName(a).localeCompare(getLangName(b)))
    $: filteredVoices = filterLang ? (langGroups[filterLang] ?? []) : voices

    function selectVoice(voice: SpeechSynthesisVoice) {
        ttsVoice.set(voice)
        previewVoice(voice)
    }

    function onLangChange(lang: string) {
        filterLang = lang
        const firstVoice = langGroups[lang]?.[0]
        if (firstVoice) selectVoice(firstVoice)
    }

    function close() {
        stopSpeech()
        dispatch("close")
    }
</script>

<div class="overlay" on:click|self={close} on:keydown={() => {}}>
    <div class="popup">
        <div class="header">
            <div class="title">
                <Icon id="volume" size={1} />
                <span>Text-to-Speech</span>
            </div>
            <button class="close-btn" on:click={close}>
                <Icon id="close" size={1} />
            </button>
        </div>

        {#if sortedLangs.length > 1}
            <div class="section">
                <p class="label">Language</p>
                <div class="lang-scroll">
                    {#each sortedLangs as lang}
                        <button class="lang-chip" class:active={filterLang === lang} on:click={() => onLangChange(lang)}>
                            {getLangName(lang)}
                        </button>
                    {/each}
                </div>
            </div>
        {/if}

        <div class="section voices-section">
            <p class="label">Voice {filteredVoices.length > 1 ? `(${filteredVoices.length})` : ""}</p>
            <div class="voice-list">
                {#each filteredVoices as voice}
                    <button class="voice-row" class:selected={$ttsVoice?.name === voice.name} on:click={() => selectVoice(voice)}>
                        <span class="check"><Icon id="check" size={0.8} /></span>
                        <span class="voice-name">{voice.name}</span>
                    </button>
                {/each}
                {#if !filteredVoices.length && voices.length}
                    <p class="empty">No voices for this language</p>
                {/if}
                {#if !voices.length}
                    <p class="empty">No voices available</p>
                {/if}
            </div>
        </div>

        <Button on:click={close} variant="contained" style="width: 100%; margin-top: 4px;">Done</Button>
    </div>
</div>

<style>
    .overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.65);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
    }

    .popup {
        background: var(--primary-lighter);
        border-radius: 14px;
        padding: 18px;
        width: min(400px, 92vw);
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        gap: 14px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    }

    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: bold;
        font-size: 1em;
    }

    .close-btn {
        background: none;
        border: none;
        color: var(--text);
        cursor: pointer;
        padding: 4px;
        border-radius: 6px;
        display: flex;
        opacity: 0.6;
        transition: opacity 0.15s;
    }
    .close-btn:hover {
        opacity: 1;
    }

    .section {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .voices-section {
        overflow: hidden;
        min-height: 0;
        flex: 1;
    }

    .label {
        font-size: 0.65em;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        opacity: 0.5;
        margin: 0;
    }

    .lang-scroll {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        max-height: 200px;
        overflow-y: auto;
    }

    .lang-chip {
        background: var(--primary-darker);
        color: var(--text);
        border: none;
        border-radius: 20px;
        padding: 5px 12px;
        font-size: 0.7em;
        cursor: pointer;
        transition: background 0.15s;
        white-space: nowrap;
    }
    .lang-chip:hover {
        background: var(--focus);
    }
    .lang-chip.active {
        background: var(--secondary);
        color: var(--secondary-text);
    }

    .voice-list {
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .voice-row {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        background: none;
        border: none;
        color: var(--text);
        border-radius: 8px;
        padding: 8px 10px;
        cursor: pointer;
        text-align: left;
        transition: background 0.12s;
    }
    .voice-row:hover {
        background: var(--hover);
    }
    .voice-row.selected {
        background: var(--focus);
    }

    .check {
        color: var(--secondary);
        visibility: hidden;
        display: flex;
        flex-shrink: 0;
    }
    .selected .check {
        visibility: visible;
    }

    .voice-name {
        flex: 1;
        font-size: 0.8em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .empty {
        font-size: 0.75em;
        opacity: 0.4;
        text-align: center;
        padding: 16px 0;
        margin: 0;
    }
</style>
