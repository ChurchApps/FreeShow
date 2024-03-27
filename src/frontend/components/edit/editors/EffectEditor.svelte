<script lang="ts">
    import { activeEdit } from "../../../stores"
    import { effects } from "../../drawer/effects/effects"
    import T from "../../helpers/T.svelte"
    import Effect from "../../output/effects/Effect.svelte"
    import Center from "../../system/Center.svelte"

    // TODO: effect editor

    $: currentId = $activeEdit.id!

    // let lines: [string, number][] = []
    // let mouse: any = null
    // let newStyles: any = {}
    // $: active = $activeEdit.items

    // let width: number = 0
    // let height: number = 0
    // $: resolution = getResolution(null, { $outputs, $styles })

    // let ratio: number = 1

    // $: {
    //     if (active.length) updateStyles()
    //     else newStyles = {}
    // }

    // function updateStyles() {
    //     if (!Object.keys(newStyles).length) return

    //     let items = Slide.items
    //     let values: any[] = []
    //     active.forEach((id) => {
    //         let item = items[id]
    //         let styles: any = getStyles(item.style)
    //         let textStyles: string = ""

    //         Object.entries(newStyles).forEach(([key, value]: any) => (styles[key] = value))
    //         Object.entries(styles).forEach((obj) => (textStyles += obj[0] + ":" + obj[1] + ";"))

    //         // TODO: move multiple!
    //         values.push(textStyles)
    //     })

    //     let override = "effect_items#" + $activeEdit.id + "indexes#" + active.join(",")
    //     history({ id: "UPDATE", newData: { key: "items", indexes: active, subkey: "style", data: values }, oldData: { id: $activeEdit.id }, location: { page: "edit", id: "effect_items", override } })
    // }

    $: effect = { id: currentId, ...effects[currentId] }
</script>

<!-- bind:offsetWidth={width} bind:offsetHeight={height} -->
<div class="parent">
    {#if effect}
        <div class="slide">
            <Effect {effect} />
        </div>
    {:else}
        <Center size={2} faded>
            <T id="empty.slide" />
        </Center>
    {/if}
</div>

<style>
    .parent {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        /* padding: 10px; */
        overflow: auto;
    }

    .slide {
        background-color: black;
        width: 100%;
        height: 100%;
        overflow: hidden;
    }
</style>
