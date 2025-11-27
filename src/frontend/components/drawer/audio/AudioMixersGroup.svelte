<script lang="ts">
    import { audioChannelsData } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import AudioChannelMixer from "./AudioChannelMixer.svelte"

    export let icon: string
    export let label: string
    export let channels: { id: string; label: string }[]

    const channelIds = channels.map(a => a.id)

    $: hasChanged = Object.entries($audioChannelsData).some(([id, a]) => channelIds.includes(id) && (a.isMuted || (a.volume ?? 1) < 1))
    $: if (hasChanged) expanded = true

    let expanded = false
    function toggleSection() {
        expanded = !expanded
    }

    function resetSection() {
        audioChannelsData.update(a => {
            for (const channelId of channelIds) {
                delete a[channelId]
            }
            return a
        })
    }
</script>

<div class="section">
    <div class="title">
        <MaterialButton style="width: 100%;{hasChanged ? 'padding: 4px 12px;' : 'padding: 8px 12px;'}" disabled={hasChanged} on:click={() => toggleSection()}>
            <span style="display: flex;gap: 8px;align-items: center;">
                <Icon id={icon} white />
                <p>{translateText(label)}</p>
            </span>

            {#if hasChanged}
                <MaterialButton title="actions.reset" style="pointer-events: all;padding: 4px;" on:click={() => resetSection()}>
                    <Icon id="reset" size={0.8} white />
                </MaterialButton>
            {:else}
                <Icon id="arrow_back_modern" class="arrow {expanded ? 'open' : ''}" size={0.6} style="opacity: 0.5;" white />
            {/if}
        </MaterialButton>
    </div>

    {#if expanded}
        <div class="mixerGroup">
            {#each channels as channel}
                <AudioChannelMixer channelId={channel.id} label={channel.label} />
            {/each}
        </div>
    {/if}
</div>

<style>
    .title {
        background-color: var(--primary-darker);
        border-bottom: 1px solid var(--primary-lighter);

        border-top-left-radius: 10px;
        border-top-right-radius: 10px;
        overflow: hidden;
    }
    .title p {
        font-weight: 500;
        font-size: 0.8rem;
        opacity: 0.8;
    }

    .title :global(button) {
        display: flex;
        justify-content: space-between;

        /* when disabled */
        opacity: 1;
    }

    .title :global(svg.arrow) {
        transition: 0.1s transform ease;
        transform: rotate(180deg);
    }
    .title :global(svg.arrow.open) {
        transform: rotate(-90deg);
    }

    .mixerGroup {
        display: flex;
        flex-direction: column;
        /* gap: 2px; */
    }
</style>
