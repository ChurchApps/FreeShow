<script lang="ts">
    import { getShortBibleName } from "../../../components/drawer/bible/scripture"
    import T from "../../../components/helpers/T.svelte"
    import MaterialButton from "../../../components/inputs/MaterialButton.svelte"
    import Center from "../../../components/system/Center.svelte"
    import { aiSmartAction, aiSttStatus, aiSuggestions, outLocked, scriptures, sttTranscript } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { Transcript } from "../../stt/transcript"
    import ConfidenceMeter from "./ConfidenceMeter.svelte"

    export let state: "loading" | "inactive" | "error" | "listening" | "processing" = "inactive"

    // the transcript follows the speech while pinned to the bottom - scrolling up to read
    // history stops the auto-jump until the user returns to the bottom
    let transcriptElem: HTMLElement | undefined
    let transcriptPinned = true
    let autoScrollTimer: NodeJS.Timeout | null = null
    $: if (transcriptPinned && ($sttTranscript.finalized || $sttTranscript.unprocessed) && transcriptElem) scrollToBottom()
    function scrollToBottom() {
        setTimeout(() => {
            if (!transcriptElem) return
            // already at the bottom: no scroll, and crucially no guard window that would swallow
            // a genuine user scroll gesture arriving between updates
            if (transcriptElem.scrollHeight - transcriptElem.scrollTop - transcriptElem.clientHeight < 2) return
            // the jump is instant (no smooth animation), so its single scroll event stays inside
            // this short guard instead of reading as a user unpin
            if (autoScrollTimer) clearTimeout(autoScrollTimer)
            autoScrollTimer = setTimeout(() => (autoScrollTimer = null), 150)
            transcriptElem.scrollTo(0, transcriptElem.scrollHeight)
        })
    }
    function onTranscriptScroll() {
        if (!transcriptElem || autoScrollTimer) return
        transcriptPinned = transcriptElem.scrollHeight - transcriptElem.scrollTop - transcriptElem.clientHeight < 40
    }

    // SUGGESTIONS
    // confident suggestions surface here so the operator can present them with one click

    $: suggestions = $aiSuggestions

    function removeSuggestion(id: string) {
        aiSmartAction.update((cur) => (cur?.id === id ? null : cur))
        aiSuggestions.update((list) => list.filter((item) => item.id !== id))
    }
</script>

<div class="card-body">
    {#if state === "error"}
        <p class="placeholder error">{translateText($aiSttStatus.message || "Something went wrong...")}</p>
    {:else if state === "processing"}
        <div class="processing-view">
            <div class="spinner large"></div>
            <p><T id="ai.processing" /></p>
        </div>
    {:else if $sttTranscript.finalized || $sttTranscript.unprocessed}
        <div class="transcript-box" bind:this={transcriptElem} on:scroll={onTranscriptScroll}>
            <p>
                {$sttTranscript.finalized}{#if $sttTranscript.unprocessed}{" "}<span class="interim">{$sttTranscript.unprocessed}</span>{/if}
            </p>

            {#if $sttTranscript.finalized}
                <div class="transcript-actions">
                    <MaterialButton icon="copy" title="actions.copy" style="padding: 10px;" on:click={() => Transcript.copy()} />
                </div>
            {/if}
        </div>
    {:else}
        <!-- loading, inactive or listening -->
        <Center faded>
            <T id="ai.waiting" />
        </Center>
    {/if}
</div>

{#if suggestions.length}
    <div class="suggestions-panel">
        {#each suggestions as suggestion (suggestion.id)}
            <div class="suggestion">
                <div class="suggestionHeader">
                    <span class="reference">
                        {suggestion.content}

                        {#if suggestion.scriptureTranslation}
                            <span class="translation">({getShortBibleName($scriptures[suggestion.scriptureTranslation]?.name)})</span>
                        {/if}
                    </span>

                    {#if suggestion.confidence}
                        <ConfidenceMeter confidence={suggestion.confidence} />
                    {/if}

                    <div class="fill" />

                    {#if suggestion.action === "presented"}
                        <MaterialButton icon="check" title="ai.auto_present" style="padding: 6px;" disabled />
                    {:else if suggestion.trigger}
                        <MaterialButton
                            icon="play"
                            disabled={$outLocked}
                            title="menu._title_display"
                            style="padding: 6px;"
                            on:click={() => {
                                suggestion.trigger?.()
                                // removeSuggestion(suggestion.id)
                            }}
                        />
                    {/if}
                    <MaterialButton icon="delete" title="actions.remove" style="padding: 6px;" on:click={() => removeSuggestion(suggestion.id)} />
                </div>
            </div>
        {/each}
    </div>
{/if}

<style>
    .card-body {
        position: relative;

        flex: 1;
        /* padding: 5px; */
        display: flex;
        align-items: center;
        justify-content: center;
        overflow-y: auto;
    }

    .transcript-box {
        width: 100%;
        max-height: 100%;
        overflow-y: auto;
        font-size: 0.95rem;
        line-height: 1.5;
        cursor: text;
    }

    .transcript-box,
    .transcript-box p,
    .transcript-box span {
        user-select: text;
    }

    .transcript-box p {
        white-space: initial;
        overflow-wrap: anywhere;
        padding: 10px 25px;
    }

    .transcript-actions {
        position: absolute;
        bottom: 8px;
        right: 10px;
    }

    .interim {
        opacity: 0.45;
    }

    .placeholder {
        font-style: italic;
        font-size: 0.9rem;
    }
    .placeholder.error {
        color: #ff5050;
        font-style: normal;
        white-space: initial;
    }

    .processing-view {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        color: #00dfd8;
    }

    .suggestion {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 14px;
    }

    .suggestions-panel {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: 180px;
        overflow-y: auto;
        flex-shrink: 0;

        background-color: rgb(0 0 0 / 0.1);
        border-top: 1px solid rgba(0, 0, 0, 0.3);
    }

    .fill {
        flex: 1;
    }

    .suggestionHeader {
        display: flex;
        align-items: center;
        gap: 5px;
        flex: 1;
    }
    .suggestionHeader .reference {
        font-weight: 600;
        white-space: nowrap;
    }

    /* Animations */
    .spinner {
        width: 22px;
        height: 22px;
        border: 2px solid rgba(255, 255, 255, 0.15);
        border-top-color: #00dfd8;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    .spinner.large {
        width: 32px;
        height: 32px;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>
