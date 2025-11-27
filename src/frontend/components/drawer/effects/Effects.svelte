<script lang="ts">
    import { onMount } from "svelte"
    import { effects, mediaOptions, outLocked, outputs, styles } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import { findMatchingOut, getResolution, setOutput } from "../../helpers/output"
    import Effect from "../../output/effects/Effect.svelte"
    import Zoomed from "../../slide/Zoomed.svelte"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import Card from "../Card.svelte"
    import EffectIcons from "./EffectIcons.svelte"

    export let searchValue = ""

    $: resolution = getResolution(null, { $outputs, $styles })
    let filteredEffects: any[] = []
    $: filteredEffects = sortByName(keysToID($effects))

    // search
    $: if (filteredEffects || searchValue !== undefined) filterSearch()
    const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~()]/g, "")
    let fullFilteredEffects: any[] = []
    function filterSearch() {
        fullFilteredEffects = clone(filteredEffects)
        if (searchValue.length > 1) fullFilteredEffects = fullFilteredEffects.filter(a => filter(a.name).includes(filter(searchValue)))
    }

    // HOVER

    let hover: null | number = null
    function mouseenter(e: any, index: number) {
        const grid = document.querySelector(".grid")
        if (!grid) return

        if (e.buttons > 0) return
        hover = index
    }

    let slowLoader = 0
    onMount(() => {
        const loader = setInterval(() => {
            slowLoader++
            if (slowLoader > fullFilteredEffects.length + 1) {
                clearInterval(loader)
                slowLoader = -1
            }
        })
    })
</script>

<div style="position: relative;height: 100%;width: 100%;overflow-y: auto;">
    {#if fullFilteredEffects.length}
        <div class="grid">
            {#each fullFilteredEffects as effect, i}
                <Card
                    class="context #effect_card{effect.isDefault ? '_default' : ''}"
                    resolution={{ width: 16, height: 9 }}
                    outlineColor={findMatchingOut(effect.id, $outputs)}
                    active={findMatchingOut(effect.id, $outputs) !== null}
                    label={effect.name}
                    renameId="effect_{effect.id}"
                    icon={effect.isDefault ? "protected" : null}
                    color={effect.color}
                    showPlayOnHover
                    on:click={e => {
                        if ($outLocked || e.ctrlKey || e.metaKey) return
                        if (e.target?.closest(".edit") || e.target?.closest(".icons")) return

                        setOutput("effects", effect.id, true)
                    }}
                    on:mouseenter={e => mouseenter(e, i)}
                    on:mouseleave={() => (hover = null)}
                >
                    <!-- icons -->
                    <EffectIcons columns={$mediaOptions.columns} effectId={effect.id} />

                    <!-- WIP dblclick open preview -->
                    <SelectElem id="effect" data={effect.id} fill draggable>
                        <Zoomed {resolution} background={effect.items?.length ? "var(--primary);" : effect.color || "var(--primary);"} checkered={!!effect.items?.length}>
                            {#if slowLoader < 0 || slowLoader > i}
                                {#key hover === i}
                                    <Effect {effect} preview={hover !== i} />
                                {/key}
                            {/if}
                        </Zoomed>
                    </SelectElem>
                </Card>
            {/each}
        </div>
    {:else}
        <Center size={1.2} faded>
            {#if filteredEffects.length}
                <T id="empty.search" />
            {:else}
                <T id="empty.general" />
            {/if}
        </Center>
    {/if}
</div>

<style>
    .grid {
        display: flex;
        flex-wrap: wrap;
        flex: 1;
        padding: 5px;
        place-content: flex-start;
    }

    .grid :global(.isSelected) {
        outline: 5px solid var(--text) !important;
    }
</style>
