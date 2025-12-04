<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { activeEdit, activePage, activePopup, activeShow, activeStage, overlays, popupData, refreshEditSlide, showsCache, special, stageShows, templates } from "../../../stores"
    import { triggerClickOnEnterSpace } from "../../../utils/clickable"
    import { formatSearch } from "../../../utils/search"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getLayoutRef } from "../../helpers/show"
    import { dynamicValueText, getDynamicIds, replaceDynamicValues } from "../../helpers/showActions"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"
    import HRule from "../../input/HRule.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import Center from "../../system/Center.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    const obj = $popupData.obj || {}
    const caret = $popupData.caret || {}
    onMount(() => popupData.set({}))

    let mode: null | "scripture" = null
    if ($activePage === "edit" && $activeEdit.type === "template" && ($templates[$activeEdit.id || ""]?.settings?.mode === "scripture" || $templates[$activeEdit.id || ""]?.category === "scripture")) mode = "scripture"

    const hidden: string[] = $special.disabledDynamicValues || []

    const values = getValues()

    function getValues() {
        let list = getDynamicIds(false, mode).map(id => ({ id }))

        const isStage = $activePage === "stage"
        const stageHidden = ["slide_text_previous", "slide_text_next"]
        if (isStage) list = list.filter(a => !stageHidden.includes(a.id))

        let separatorId = ""
        // the ones that can have a custom name should be first (to prevent it from overwriting a category)
        const separators = ["$", "timer_", "meta_", "rss_", "project_", "time_", "show_", "slide_text_", "video_", "audio_", "scripture_"]

        let newList: { [key: string]: typeof list } = {}
        list.forEach(value => {
            const separator = separators.find(a => value.id.includes(a)) || ""
            if (separator && separatorId !== separator && separatorId !== "$" && !newList[separator]?.length) {
                separatorId = separator
                newList[separatorId] = []
            }

            if (hidden.includes(separatorId.slice(0, -1))) return

            newList[separatorId].push(value)
        })

        return newList
    }

    function getTitle(id: string) {
        if (id === "scripture_") return "tabs.scripture"
        if (id === "time_") return "timer.time"
        if (id === "project_") return "guide_title.project"
        if (id === "show_") return "guide_title.show"
        if (id === "slide_text_") return "edit.text"
        if (id === "video_") return "edit.video"
        if (id === "audio_") return "tools.audio"
        if (id === "meta_") return "tools.metadata"
        if (id === "timer_") return "items.timer"
        if (id === "rss_") return "settings.rss"
        if (id === "$") return "items.variable"
        return ""
    }

    let defaultValues = clone(values)
    $: if (defaultValues) search()

    let searchedValues = clone(defaultValues)
    let searchValue = ""
    // let previousSearchValue = ""
    let resetInput = false
    function search(value = "") {
        searchValue = formatSearch(value.replaceAll(" ", "_"))

        if (searchValue.length < 2) {
            searchedValues = clone(defaultValues)
            return
        }

        let currentValuesList = clone(defaultValues) // searchedValues
        // reset if search value changed
        // if (!searchValue.includes(previousSearchValue)) currentValuesList = clone(defaultValues)

        searchedValues = {
            search: Object.values(currentValuesList)
                .flat()
                .filter(a => formatSearch(a.id).includes(searchValue))
        }

        // previousSearchValue = searchValue
    }

    function applyValue(e: any, id = "") {
        if (!id) {
            if (e.key !== "Enter" || searchValue.length < 2) return
            id = Object.values(searchedValues)[0]?.[0]?.id
        }
        if (!id) return

        if (obj.contextElem?.classList.contains("#meta_message")) {
            let message = _show().get("message") || {}
            let data = { ...message, text: (message.text || "") + `{${id}}` }
            let override = "show#" + $activeShow!.id + "_message"

            history({ id: "UPDATE", newData: { data, key: "message" }, oldData: { id: $activeShow!.id }, location: { page: "show", id: "show_key", override } })
            finish()
            return
        }

        let isStage = !!obj.contextElem?.classList.contains("stage_item")
        if (!obj.contextElem?.classList.contains("editItem") && !isStage) return

        let edit = $activeEdit

        if (isStage) {
            let activeItemId = $activeStage?.items[0]
            if (!$stageShows[$activeStage.id!] || !activeItemId) return

            stageShows.update(a => {
                a[$activeStage.id!].items[activeItemId] = updateItemText(a[$activeStage.id!]?.items[activeItemId])
                return a
            })

            refreshEditSlide.set(true)
            finish()
            return
        }

        if (edit.id) {
            if (edit.type === "overlay") {
                overlays.update(a => {
                    a[edit.id!].items = updateItemText(a[edit.id!].items)
                    return a
                })
            } else if (edit.type === "template") {
                templates.update(a => {
                    a[edit.id!].items = updateItemText(a[edit.id!].items)
                    console.log(a[edit.id!].items)
                    return a
                })
            }

            refreshEditSlide.set(true)
            finish()
            return
        }

        let showId = $activeShow?.id || ""
        let ref = getLayoutRef(showId)
        let slideId = ref[edit.slide || 0]?.id || ""

        showsCache.update(a => {
            if (!a[showId]?.slides?.[slideId]) return a

            a[showId].slides[slideId].items = updateItemText(a[showId].slides[slideId].items)
            return a
        })

        refreshEditSlide.set(true)
        finish()

        function updateItemText(items) {
            let replaced = false

            let lines = items[edit.items?.[0]]?.lines || []
            if (isStage) lines = items?.lines || []

            lines[caret.line]?.text?.forEach(text => {
                if (replaced) return

                let value = text.value
                if (value.length < caret.pos) {
                    caret.pos -= value.length
                    return
                }

                let valueIdString = dynamicValueText(id)
                let newValue = value.slice(0, caret.pos) + valueIdString + value.slice(caret.pos)
                text.value = newValue
                replaced = true

                // if applying multiple
                caret.pos += valueIdString.length
            })

            return items
        }

        function finish() {
            if (e.ctrlKey) {
                resetInput = true
                setTimeout(() => (resetInput = false))
                searchValue = ""
                search()
            } else {
                activePopup.set(null)
            }
        }
    }

    // custom ref
    const ref = { showId: $activeShow?.id, layoutId: _show().get("settings.activeLayout"), slideIndex: $activeEdit.slide, type: $activePage === "stage" ? "stage" : $activeEdit.type || "show", id: $activeEdit.id, mode }

    // UPDATE DYNAMIC VALUES e.g. {time_} EVERY SECOND
    let updateDynamic = 0
    const dynamicInterval = setInterval(() => {
        updateDynamic++
    }, 1000)
    onDestroy(() => clearInterval(dynamicInterval))
</script>

<svelte:window on:keydown={applyValue} />

<MaterialButton class="popup-options" icon="edit" iconSize={1.1} title="create_show.more_options" on:click={() => activePopup.set("manage_dynamic_values")} white />

{#key resetInput}
    <MaterialTextInput label="main.search" value="" on:input={e => search(e.detail)} autofocus />
{/key}

<div style="position: relative;height: 100%;width: calc(100vw - (var(--navigation-width) + 20px) * 2);overflow-y: auto;">
    {#if Object.values(searchedValues)[0]?.length}
        <div class="list" style={searchValue.length > 1 ? "margin-top: 10px;" : ""}>
            {#each Object.entries(searchedValues) as [key, values]}
                {#if key !== "search" && !hidden.includes(key.slice(0, -1))}
                    <HRule title={getTitle(key)} />
                {/if}

                <div class="grid">
                    {#each values as value, i}
                        {@const preview = replaceDynamicValues(`{${value.id}}`, ref, updateDynamic)}
                        <div class="value" class:active={searchValue.length > 1 && i === 0 ? "border: 2px solid var(--secondary-opacity);" : ""} role="button" tabindex="0" on:click={e => applyValue(e, value.id)} on:keydown={triggerClickOnEnterSpace}>
                            <p class="preview">
                                {#if preview}{@html preview}{:else}—{/if}
                            </p>

                            <p style="display: inline-flex;">
                                <span style="color: var(--secondary);">{"{"}</span>
                                {#if value.id.startsWith("$")}
                                    <span style="color: var(--secondary);">{"$"}</span>
                                    {value.id.slice(1)}
                                {:else}
                                    <!-- variable_set_ -->
                                    <!-- <span style="color: var(--secondary);">{value.id.slice(0, value.id.indexOf("_") + 1)}</span> -->
                                    <!-- {value.id.slice(value.id.indexOf("_") + 1)} -->
                                    {value.id}
                                {/if}
                                <span style="color: var(--secondary);">{"}"}</span>
                            </p>
                        </div>
                    {/each}
                </div>
            {/each}
        </div>
    {:else}
        <Center size={1.2} faded style="height: 100px;padding-top: 20px;">
            {#if values.length}
                <T id="empty.search" />
            {:else}
                <T id="empty.general" />
            {/if}
        </Center>
    {/if}
</div>

<style>
    .list {
        display: flex;
        flex-direction: column;
        padding: 5px;
    }

    .grid {
        display: flex;
        justify-content: center;
        /* place-content: flex-start; */
        flex-wrap: wrap;
        gap: 5px;
    }

    .value {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        gap: 10px;

        border-radius: 4px;

        background-color: var(--primary-darkest);
        padding: 10px;

        max-width: 600px;
    }

    .value.active {
        outline: 2px solid var(--secondary-opacity);
        outline-offset: 0;
    }
    .value:active {
        outline: 2px solid var(--secondary);
        outline-offset: 0;
    }
    .value:focus {
        outline: 2px solid var(--secondary);
        outline-offset: 0;
    }

    .preview {
        font-weight: bold;
        font-size: 1.2em;
        text-align: center;
        white-space: initial;
        max-height: 200px;
    }
</style>
