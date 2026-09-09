<script lang="ts">
    import { fly } from "svelte/transition"
    import Icon from "../../../components/helpers/Icon.svelte"
    import MaterialButton from "../../../components/inputs/MaterialButton.svelte"
    import { aiSmartAction, scriptures } from "../../../stores"
    import AiRing from "./AiRing.svelte"
    import ConfidenceMeter from "./ConfidenceMeter.svelte"
    import { getShortBibleName } from "../../../components/drawer/bible/scripture"

    $: smartAction = $aiSmartAction
</script>

<!-- this will show the latest transcript segment (& interim) -->
<!-- {#if !isOpen && isListening && ($sttTranscript.finalized || $sttTranscript.unprocessed)}
    <div class="ticker-wrap">
        <AiRing {state} {audioLevel} borderRadius="12px" borderWidth="1.5px">
            <button class="ticker" on:click={toggleExpand}>
                {$sttTranscript.finalized}{#if $sttTranscript.unprocessed}{" "}<span class="interim">{$sttTranscript.unprocessed}</span>{/if}
            </button>
        </AiRing>
    </div>
{/if} -->

{#if smartAction}
    <div class="ticker-wrap" transition:fly={{ x: 45 + 62 / 2, duration: 200 }}>
        <!-- border-radius: 50px 10px 10px 50px; -->
        <MaterialButton
            style="padding: 0;border-radius: 50px;"
            on:click={() => {
                if (smartAction?.trigger) {
                    smartAction.trigger()
                    setTimeout(() => aiSmartAction.set(null), 500)
                } else {
                    aiSmartAction.set(null)
                }
            }}
        >
            <!-- borderRadius="20px 10px 10px 20px" -->
            <AiRing opacity={0.85}>
                <div class="suggestion" style="margin-right: calc((62px / 2) - 4px);">
                    {#if smartAction?.action === "presented"}
                        <Icon id="check" white />
                        <p>Presented:</p>
                        <span style="font-weight: bold;">{smartAction.content}</span>
                    {:else if smartAction?.action === "present"}
                        <Icon id="play" white />

                        <p>Click to present:</p>
                        <span style="font-weight: bold;">
                            {smartAction.content}

                            {#if smartAction?.scriptureTranslation}
                                <span class="translation">({getShortBibleName($scriptures[smartAction.scriptureTranslation]?.name)})</span>
                            {/if}
                        </span>
                    {/if}

                    {#if smartAction?.confidence}
                        <ConfidenceMeter confidence={smartAction.confidence} />
                    {/if}
                </div>
            </AiRing>
        </MaterialButton>
    </div>
{/if}

<style>
    /* on the closed bubble's row, to its left (bubble: 62px at 45px/45px) */
    .ticker-wrap {
        display: flex;
        max-width: 60vw;

        position: fixed;
        /* right: 112px; */
        right: calc(45px + (62px / 2));
        bottom: calc(45px + (62px / 2));
        transform: translateY(50%);
        z-index: 4998;

        /* the ring's inner card is opaque; the drop shadow lifts it off whatever panel is behind */
        filter: drop-shadow(0 8px 25px rgba(0, 0, 0, 0.5));
    }

    .suggestion {
        display: flex;
        align-items: center;
        gap: 8px;

        padding: 8px 12px;
    }
</style>
