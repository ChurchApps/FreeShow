<script lang="ts">
    import type { EffectItem } from "../../../types/Effects"
    import type { TabsObj } from "../../../types/Tabs"
    import { activeEdit, activePopup, effects } from "../../stores"
    import { clone } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import CombinedInput from "../inputs/CombinedInput.svelte"
    import Tabs from "../main/Tabs.svelte"
    import EditValues from "./tools/EditValues.svelte"
    import { effectEdits } from "./values/effects"

    let tabs: TabsObj = {
        effect: { name: "items.effect", icon: "image" }
        // filters: { name: "edit.filters", icon: "filter" },
        // options: { name: "", icon: "options" }, // canvas settings (background color)
    }
    let active: string = Object.keys(tabs)[0]

    // update values
    $: effectId = $activeEdit.id || ""
    $: currentEffect = $effects[effectId]
    // $: currentEdits = effectEdits[currentEffect.type]

    // let edits: any = {}
    // // let filterEdits = clone(currentEffect.edit)
    // $: if (currentEffect) edits = {} // clone(currentEffect?.items)
    // $: console.log(edits)

    // $: if (geteffectType(getExtension(effectId)) === "video") addVideoOptions()
    // else edits = clone(effectEdits.effect?.edit)
    // function addVideoOptions() {
    //     if (!edits) return

    //     edits.video = clone(videoEdit)
    // }

    // set values
    // $: if (currenteffect) {
    //     edits.default[1].value = currenteffect.flipped || false
    //     edits.default[0].value = currenteffect.fit || "contain"
    //     if (edits.video) edits.video[0].value = currenteffect.speed || "1"

    //     // update filters
    //     let filters = getFilters(currenteffect.filter)
    //     let defaultFilters = effectFilters.effect?.edit?.default || []
    //     filterEdits.default.forEach((filter) => {
    //         let value = filters[filter.key] ?? defaultFilters.find((a) => a.key === filter.key)?.value
    //         let index = filterEdits.default.findIndex((a) => a.key === filter.key)
    //         filterEdits.default[index].value = value
    //     })
    // }

    export function valueChanged(input: any, itemIndex: number) {
        if (!effectId) return

        effects.update((a) => {
            a[effectId].items[itemIndex][input.id] = input.value
            return a
        })
    }

    function getEdits(item: EffectItem) {
        const edits = clone(effectEdits[item.type] || [])

        edits.forEach((edit) => {
            const value = item[edit.id]
            if (value !== undefined) edit.value = value
        })

        return { default: edits }
    }
</script>

<div class="main border editTools">
    <Tabs {tabs} bind:active />
    <div class="content">
        {#if active === "effect"}
            {#if currentEffect}
                {#each currentEffect.items || [] as item, i}
                    <p>{item.type}</p>
                    <EditValues edits={getEdits(item)} on:change={(e) => valueChanged(e.detail, i)} />
                {/each}
            {/if}

            <CombinedInput>
                <Button style="width: 100%;" on:click={() => activePopup.set("effect_items")} center dark>
                    <Icon id="add" right />
                    <T id="settings.add" />
                </Button>
            </CombinedInput>

            <!-- {:else if active === "filters"}
            <EditValues edits={filterEdits} on:change={(e) => valueChanged(e.detail)} /> -->
        {/if}
    </div>

    <!-- <span style="display: flex;">
        <Button style="flex: 1;" on:click={() => console.log("reset")} dark center>
            <Icon id="reset" right />
            <T id={"actions.reset"} />
        </Button>
    </span> -->
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        height: 100%;
    }

    .content {
        height: 100%;
        overflow-y: auto;
        overflow-x: hidden;
    }
</style>
