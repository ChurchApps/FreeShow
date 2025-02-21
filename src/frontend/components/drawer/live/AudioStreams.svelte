<script lang="ts">
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { activePopup, audioStreams, dictionary, labelsDisabled, playingAudio } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { keysToID, sortByName } from "../../helpers/array"
    import Button from "../../inputs/Button.svelte"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"

    $: streamsList = sortByName(keysToID($audioStreams))
</script>

{#if streamsList.length}
    <div class="streams">
        {#each streamsList as stream}
            <SelectElem id="audio_stream" data={{ id: stream.id, type: "audio_stream" }} draggable>
                <Button class="context #audio_stream" style="flex: 1;" outline={Object.keys($playingAudio).includes(stream.value)} on:click={() => AudioPlayer.start(stream.value, { name: stream.name })}>
                    <div class="stream">
                        <span style="padding-left: 5px;">
                            <p>{stream.name}</p>
                        </span>

                        <span style="padding-left: 10px;font-weight: normal;opacity: 0.5;">
                            {stream.value}
                        </span>
                    </div>
                </Button>
            </SelectElem>
        {/each}
    </div>
{:else}
    <Center faded>
        <T id="empty.general" />
    </Center>
{/if}

<div style="display: flex;background-color: var(--primary-darkest);">
    <Button style="flex: 1;" on:click={() => activePopup.set("audio_stream")} center title={$dictionary.new?.audio_stream}>
        <Icon id="add" right={!$labelsDisabled} />
        {#if !$labelsDisabled}<T id="new.audio_stream" />{/if}
    </Button>
</div>

<style>
    .streams {
        flex: 1;
        overflow: auto;
    }
    .streams :global(.selectElem) {
        display: flex;
    }
    .streams :global(.selectElem:not(.isSelected):nth-child(even)) {
        background-color: rgb(0 0 20 / 0.08);
    }

    .stream {
        padding: 3px 5px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .stream span {
        display: flex;
        align-items: center;
    }
</style>
