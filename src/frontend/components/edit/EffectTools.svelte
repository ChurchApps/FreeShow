<script lang="ts">
    import type { TabsObj } from "../../../types/Tabs"
    import { activeEdit } from "../../stores"
    import { effects } from "../drawer/effects/effects"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { clone } from "../helpers/array"
    import Button from "../inputs/Button.svelte"
    import Tabs from "../main/Tabs.svelte"
    import EditValues from "./tools/EditValues.svelte"

    let tabs: TabsObj = {
        effect: { name: "items.effect", icon: "image" },
        // filters: { name: "edit.filters", icon: "filter" },
        // options: { name: "", icon: "options" },
    }
    let active: string = Object.keys(tabs)[0]

    // update values
    $: effectId = $activeEdit.id || ""
    $: currentEffect = effects[effectId]

    let edits: any = {}
    // let filterEdits = clone(currentEffect.edit)
    $: if (currentEffect) edits = clone(currentEffect?.edit)
    $: console.log(edits)

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

    // function reset() {
    //     let deleteKeys: string[] = ["flipped", "fit", "speed"]

    //     // reset
    //     if (active === "filters") deleteKeys = ["filter"]
    //     else if (active !== "effect") return
    //     deleteKeys.forEach((key) => removeStore("effect", { keys: [effectId, key] }))

    //     // update output
    //     let currentOutput = $outputs[getActiveOutputs()[0]]
    //     let bg = currentOutput?.out?.background
    //     if (!bg) return
    //     deleteKeys.forEach((key) => delete bg[key])
    //     setOutput("background", bg)
    // }

    export function valueChanged(input: any) {
        if (!effectId) return

        let value = input.value
        console.log(value)
        // if (input.id === "filter") value = addFilterString(currenteffect?.filter || "", [input.key, value])

        // updateStore("effect", { keys: [effectId, input.id], value })

        // // update output filters
        // let currentOutput = $outputs[getActiveOutputs()[0]]
        // if (!currentOutput.out?.background || currentOutput.out?.background?.path !== effectId) return
        // let bg = currentOutput.out.background
        // bg[input.id] = value
        // setOutput("background", bg)
    }
</script>

<div class="main border editTools">
    <Tabs {tabs} bind:active />
    <div class="content">
        {#if active === "effect"}
            <EditValues {edits} on:change={(e) => valueChanged(e.detail)} />
            <!-- {:else if active === "filters"}
            <EditValues edits={filterEdits} on:change={(e) => valueChanged(e.detail)} /> -->
        {/if}
    </div>

    <span style="display: flex;">
        <Button style="flex: 1;" on:click={() => console.log("reset")} dark center>
            <Icon id="reset" right />
            <T id={"actions.reset"} />
        </Button>
    </span>
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
