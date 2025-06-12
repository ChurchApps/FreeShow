<script lang="ts">
    import type { EffectItem } from "../../../types/Effects"
    import type { TabsObj } from "../../../types/Tabs"
    import { activeEdit, activePopup, dictionary, effects } from "../../stores"
    import { clone } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import { addToPos } from "../helpers/mover"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import Color from "../inputs/Color.svelte"
    import CombinedInput from "../inputs/CombinedInput.svelte"
    import Tabs from "../main/Tabs.svelte"
    import EditValues from "./tools/EditValues.svelte"
    import { effectEdits } from "./values/effects"

    let tabs: TabsObj = {
        effect: { name: "items.effect", icon: "effects" },
        // filters: { name: "edit.filters", icon: "filter" },
        options: { name: "edit.options", icon: "options", overflow: true }
    }
    let active: string = Object.keys(tabs)[0]

    // update values
    $: effectId = $activeEdit.id || ""
    $: currentEffect = $effects[effectId] || {}
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

    let openedMenus: number[] = []
    function toggleMenu(index: number) {
        if (openedMenus.includes(index)) openedMenus.splice(openedMenus.indexOf(index), 1)
        else openedMenus.push(index)
        openedMenus = openedMenus
    }

    function deleteItem(index: number) {
        if (openedMenus.includes(index)) toggleMenu(index)
        openedMenus = openedMenus.map((i) => (i > index ? i - 1 : i))

        effects.update((a) => {
            a[effectId].items.splice(index, 1)
            return a
        })
    }

    function toggleHidden(index: number) {
        effects.update((a) => {
            a[effectId].items[index].hidden = !a[effectId].items[index].hidden
            return a
        })
    }

    let moved = false
    function move(index: number, newIndex: number) {
        effects.update((a) => {
            const item = a[effectId].items.splice(index, 1)
            a[effectId].items = addToPos(a[effectId].items, item, newIndex)
            return a
        })

        moved = true
        setTimeout(() => (moved = false))
    }

    // $: if ((currentEffect.items || []).length < currentItems.length) {
    //     openedMenus.push(currentItems.length - 1)
    //     openedMenus = openedMenus
    // }
    let currentItems: any[]
    $: currentItems = currentEffect.items || []
</script>

<div class="main border editTools">
    <Tabs {tabs} bind:active />
    <div class="content">
        {#if active === "effect"}
            {#if currentEffect}
                <div class="items">
                    {#key moved}
                        {#each currentItems as item, i}
                            <CombinedInput textWidth={10} style={i === 0 ? "" : "border-top: 2px solid var(--primary-lighter);"}>
                                <p style="width: 100%;"><T id="effect.{item.type === 'shape' ? item.shape : item.type}" /></p>

                                {#if i < currentItems.length - 1}
                                    <Button class="down" on:click={() => move(i, i + 1)}>
                                        <Icon id="down" />
                                    </Button>
                                {/if}
                                {#if i > 0}
                                    <Button class="up" on:click={() => move(i, i - 1)}>
                                        <Icon id="up" />
                                    </Button>
                                {/if}

                                <Button on:click={() => toggleHidden(i)}>
                                    <Icon id={item.hidden ? "hide" : "eye"} white={!item.hidden} />
                                </Button>

                                <Button title={$dictionary.actions?.delete} on:click={() => deleteItem(i)} redHover>
                                    <Icon id="delete" white />
                                </Button>

                                {#if effectEdits[item.type]}
                                    <Button style="padding: 0 8.5px !important" class="submenu_open" on:click={() => toggleMenu(i)}>
                                        {#if openedMenus.includes(i)}
                                            <Icon class="submenu_open" id="arrow_down" size={1.4} style="fill: var(--secondary);" />
                                        {:else}
                                            <Icon class="submenu_open" id="arrow_right" size={1.4} style="fill: var(--text);" />
                                        {/if}
                                    </Button>
                                {/if}
                            </CombinedInput>

                            {#if openedMenus.includes(i)}
                                <EditValues edits={getEdits(item)} on:change={(e) => valueChanged(e.detail, i)} />
                            {/if}
                        {/each}
                    {/key}
                </div>
            {/if}

            <CombinedInput style="border-top: 2px solid var(--primary-lighter);">
                <Button
                    style="width: 100%;"
                    on:click={() => {
                        activePopup.set("effect_items")
                        const nextIndex = currentItems.length
                        if (!openedMenus.includes(nextIndex)) openedMenus.push(nextIndex)
                    }}
                    center
                    dark
                >
                    <Icon id="add" right />
                    <T id="settings.add" />
                </Button>
            </CombinedInput>

            <!-- {:else if active === "filters"}
            <EditValues edits={filterEdits} on:change={(e) => valueChanged(e.detail)} /> -->
        {:else if active === "options"}
            <!-- canvas settings -->
            <div class="section">
                <CombinedInput>
                    <p><T id="edit.background_color" /></p>
                    <Color
                        bind:value={currentEffect.background}
                        on:input={(e) => {
                            effects.update((a) => {
                                a[effectId].background = e.detail
                                return a
                            })
                        }}
                        enableNoColor
                        allowGradients
                    />
                </CombinedInput>
            </div>
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

        padding: 10px;
    }

    .items {
        display: flex;
        flex-direction: column;
    }

    .content :global(.section) {
        margin: 0;
    }

    .section {
        display: flex;
        flex-direction: column;
        margin: 10px;
    }
</style>
