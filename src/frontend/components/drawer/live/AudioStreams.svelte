<script lang="ts">
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { audioStreams, playingAudio } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import { keysToID, sortByName } from "../../helpers/array"
    import Button from "../../inputs/Button.svelte"
    import Loader from "../../main/Loader.svelte"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"

    $: streamsList = sortByName(keysToID($audioStreams))

    let loadingStreams = new Set<string>()
    async function loadStream(stream: string) {
        if (loadingStreams.has(stream)) return
        loadingStreams.add(stream)
        loadingStreams = loadingStreams

        const streamData = $audioStreams[stream]
        await AudioPlayer.start(streamData.value, { name: streamData.name })

        loadingStreams.delete(stream)
        loadingStreams = loadingStreams
    }
</script>

{#if streamsList.length}
    <div class="streams">
        {#each streamsList as stream}
            {@const isLoading = loadingStreams.has(stream.id)}

            <SelectElem id="audio_stream" data={{ id: stream.id, type: "audio_stream" }} draggable>
                <Button class="context #audio_stream" style="flex: 1;" outline={Object.keys($playingAudio).includes(stream.value)} on:click={() => loadStream(stream.id)} bold={false}>
                    <div class="stream">
                        <div class="loader" style="overflow: hidden;">
                            {#if isLoading}<Loader size={0.3} />{/if}
                        </div>

                        <span style="padding-inline-start: 5px;">
                            <p>{stream.name}</p>
                        </span>

                        <span style="padding-inline-start: 10px;font-weight: normal;opacity: 0.5;">
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

<style>
    .streams {
        flex: 1;
        overflow: auto;

        padding-bottom: 60px;
    }
    .streams :global(.selectElem) {
        display: flex;
    }
    .streams :global(.selectElem:not(.isSelected):nth-child(even)) {
        background-color: rgb(0 0 20 / 0.08);
    }

    .stream {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .stream span {
        display: flex;
        align-items: center;
    }

    .loader :global(.loader) {
        padding-inline-start: 0;
        border: 3px solid var(--primary-lighter);
        border-top: 3px solid var(--secondary);
    }
</style>
