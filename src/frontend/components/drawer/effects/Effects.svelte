<script lang="ts">
    import { mediaOptions, outLocked, outputs, styles } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import { clone } from "../../helpers/array"
    import { findMatchingOut, getResolution, setOutput } from "../../helpers/output"
    import Effect from "../../output/effects/Effect.svelte"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import Card from "../Card.svelte"
    import { effects } from "./effects"

    export let active: string | null
    export let searchValue: string = ""
    console.log(active)

    $: resolution = getResolution(null, { $outputs, $styles })

    let filteredEffects: any[] = []
    $: filteredEffects = Object.keys(effects)
        .map((id) => ({ id, ...effects[id] }))
        .sort((a, b) => a.name.localeCompare(b.name))

    // search
    $: if (filteredEffects || searchValue !== undefined) filterSearch()
    const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~()]/g, "")
    let fullFilteredEffects: any[] = []
    function filterSearch() {
        fullFilteredEffects = clone(filteredEffects)
        if (searchValue.length > 1) fullFilteredEffects = fullFilteredEffects.filter((a) => filter(a.name).includes(searchValue))
    }

    let nextScrollTimeout: any = null
    function wheel(e: any) {
        if (!e.ctrlKey && !e.metaKey) return
        if (nextScrollTimeout) return

        mediaOptions.set({ ...$mediaOptions, columns: Math.max(2, Math.min(10, $mediaOptions.columns + (e.deltaY < 0 ? -100 : 100) / 100)) })

        // don't start timeout if scrolling with mouse
        if (e.deltaY > 100 || e.deltaY < -100) return
        nextScrollTimeout = setTimeout(() => {
            nextScrollTimeout = null
        }, 500)
    }
</script>

<div style="position: relative;height: 100%;overflow-y: auto;" on:wheel={wheel}>
    {#if fullFilteredEffects.length}
        <div class="grid">
            {#each fullFilteredEffects as effect}
                <Card
                    class="context #effect_card"
                    outlineColor={findMatchingOut(effect.id, $outputs)}
                    active={findMatchingOut(effect.id, $outputs) !== null}
                    label={effect.name || "—"}
                    color={effect.color}
                    {resolution}
                    on:click={(e) => {
                        if (!$outLocked && !e.ctrlKey && !e.metaKey) setOutput("effects", effect.id, true)
                    }}
                >
                    <SelectElem id="effect" data={effect.id} fill draggable>
                        <div class="slide">
                            <Effect {effect} />
                        </div>
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

<!-- <div class="tabs">
    <Button
        style="flex: 1;"
        on:click={() => {
            history({ id: "UPDATE", location: { page: "drawer", id: "effect" } })
        }}
        center
        title={$dictionary.new?.effect}
    >
        <Icon id="add" right={!$labelsDisabled} />
        {#if !$labelsDisabled}<T id="new.effect" />{/if}
    </Button>
</div> -->

<style>
    .grid {
        display: flex;
        flex-wrap: wrap;
        flex: 1;
        padding: 5px;
        place-content: flex-start;
    }

    .grid :global(.isSelected) {
        outline: 5px solid var(--secondary-text) !important;
    }

    .slide {
        background-color: black;
        width: 100%;
        height: 100%;
        aspect-ratio: 19/9;
        overflow: hidden;
    }

    /* .tabs {
        display: flex;
        background-color: var(--primary-darkest);
    } */
</style>
