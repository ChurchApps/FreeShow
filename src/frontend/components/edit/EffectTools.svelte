<script lang="ts">
    import type { EffectItem } from "../../../types/Effects"
    import type { TabsObj } from "../../../types/Tabs"
    import { activeEdit, activePopup, effects } from "../../stores"
    import { clone } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import { addToPos } from "../helpers/mover"
    import T from "../helpers/T.svelte"
    import InputRow from "../input/InputRow.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialColorInput from "../inputs/MaterialColorInput.svelte"
    import MaterialNumberInput from "../inputs/MaterialNumberInput.svelte"
    import Tabs from "../main/Tabs.svelte"
    import EditValues from "./tools/EditValues.svelte"
    import { effectSections } from "./values/effects"

    let tabs: TabsObj = {
        effect: { name: "items.effect", icon: "effects" },
        // filters: { name: "edit.filters", icon: "filter" },
        options: { name: "edit.options", icon: "options", overflow: true }
    }
    let active: string = Object.keys(tabs)[0]

    // update values
    $: effectId = $activeEdit.id || ""
    $: currentEffect = $effects[effectId] || {}

    export function valueChanged(input: any, itemIndex: number) {
        if (!effectId) return

        effects.update(a => {
            a[effectId].items[itemIndex][input.id] = input.values.value
            return a
        })
    }

    function getItemSections(item: EffectItem) {
        if (!effectSections[item.type]) return null
        return { default: clone(effectSections[item.type]) }
    }

    function deleteItem(index: number) {
        // not tested:
        let newOpenedMenus: number[] = []
        Object.keys(openedMenus).forEach((menuIndex: string | number) => {
            menuIndex = Number(menuIndex)
            if (!openedMenus[menuIndex] || menuIndex === index) return
            newOpenedMenus.push(menuIndex + (menuIndex > index ? 1 : 0))
        })
        openedMenus = {}
        newOpenedMenus.forEach(index => (openedMenus[index] = true))

        effects.update(a => {
            a[effectId].items.splice(index, 1)
            return a
        })
    }

    function toggleHidden(index: number) {
        effects.update(a => {
            a[effectId].items[index].hidden = !a[effectId].items[index].hidden
            return a
        })
    }

    let moved = false
    function move(index: number, newIndex: number) {
        openedMenus = {}

        effects.update(a => {
            const item = a[effectId].items.splice(index, 1)
            a[effectId].items = addToPos(a[effectId].items, item, newIndex)
            return a
        })

        moved = true
        setTimeout(() => (moved = false))
    }

    let currentItems: any[]
    $: currentItems = currentEffect.items || []

    let openedMenus: { [key: string]: boolean } = {}
</script>

<div class="main border editTools">
    <Tabs {tabs} bind:active />

    <div class="content">
        {#if active === "effect"}
            {#if currentEffect}
                <div class="items">
                    {#key moved}
                        {#each currentItems as item, i}
                            {@const editContent = getItemSections(item)}

                            <InputRow arrow={!!editContent} bind:open={openedMenus[i]}>
                                <div class="title">
                                    <p style="width: 100%;"><T id="effect.{item.type === 'shape' ? item.shape : item.type}" /></p>
                                </div>

                                {#if i < currentItems.length - 1}
                                    <MaterialButton class="down" icon="down" on:click={() => move(i, i + 1)} />
                                {/if}
                                {#if i > 0}
                                    <MaterialButton class="up" icon="up" on:click={() => move(i, i - 1)} />
                                {/if}

                                <MaterialButton on:click={() => toggleHidden(i)}>
                                    <Icon id={item.hidden ? "hide" : "eye"} white={!item.hidden} />
                                </MaterialButton>

                                <MaterialButton title="actions.delete" on:click={() => deleteItem(i)}>
                                    <Icon id="delete" white />
                                </MaterialButton>

                                <svelte:fragment slot="menu">
                                    {#if editContent}
                                        <EditValues sections={editContent} {item} on:change={e => valueChanged(e.detail, i)} />
                                    {/if}
                                </svelte:fragment>
                            </InputRow>
                        {/each}
                    {/key}
                </div>
            {/if}

            <MaterialButton
                variant="outlined"
                style="width: 100%;margin-top: 8px;"
                icon="add"
                on:click={() => {
                    activePopup.set("effect_items")
                    const nextIndex = currentItems.length
                    if (!openedMenus[nextIndex]) openedMenus[nextIndex] = true
                }}
            >
                <T id="settings.add" />
            </MaterialButton>

            <!-- {:else if active === "filters"}
            <EditValues edits={filterEdits} on:change={(e) => valueChanged(e.detail)} /> -->
        {:else if active === "options"}
            <!-- canvas settings -->
            <div class="section">
                <MaterialColorInput
                    label="edit.background_color"
                    value={currentEffect.background}
                    on:input={e => {
                        effects.update(a => {
                            a[effectId].background = e.detail
                            return a
                        })
                    }}
                    allowEmpty
                    noLabel
                />
                <!-- allowGradients -->
                <MaterialNumberInput
                    label="edit.opacity"
                    value={(currentEffect.opacity ?? 1) * 100}
                    max={100}
                    on:change={e => {
                        effects.update(a => {
                            a[effectId].opacity = e.detail / 100
                            return a
                        })
                    }}
                />
            </div>
        {/if}
    </div>
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

    .items :global(button) {
        padding: 12px;
    }

    .title {
        display: flex;
        align-items: center;
        flex: 1;
        padding: 0 10px;

        background-color: var(--primary-darker);
    }

    .content :global(.tools) {
        padding: 0;
    }
    .content :global(.section) {
        border: none;
    }
</style>
