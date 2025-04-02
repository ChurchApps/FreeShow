<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { activeEdit, activePage, activePopup, activeShow, activeStage, dictionary, overlays, popupData, refreshEditSlide, showsCache, stageShows, templates } from "../../../stores"
    import { formatSearch } from "../../../utils/search"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getLayoutRef } from "../../helpers/show"
    import { dynamicValueText, getDynamicIds, replaceDynamicValues } from "../../helpers/showActions"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"
    import HRule from "../../input/HRule.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import Center from "../../system/Center.svelte"

    const obj = $popupData.obj || {}
    const caret = $popupData.caret || {}
    onMount(() => popupData.set({}))

    const values = getValues()

    function getValues() {
        const seperators = ["variable_", "time_", "show_", "video_", "meta_"]

        let list = getDynamicIds().map((id) => ({ id }))
        let newList: { [key: string]: typeof list } = {}

        let seperatorId = ""
        list.forEach((value) => {
            const seperator = seperators.find((a) => value.id.includes(a)) || ""
            if (seperator && seperatorId !== seperator && seperatorId !== "variable_") {
                seperatorId = seperator
                newList[seperatorId] = []
            }
            newList[seperatorId].push(value)
        })

        return newList
    }

    function getTitle(id: string) {
        if (id === "time_") return "timer.time"
        if (id === "show_") return "guide_title.show"
        if (id === "video_") return "edit.video"
        if (id === "meta_") return "tools.metadata"
        if (id === "variable_") return "items.variable"
        return ""
    }

    let defaultValues = clone(values)
    $: if (defaultValues) search()

    let searchedValues = clone(defaultValues)
    let searchValue = ""
    let previousSearchValue = ""
    let resetInput = false
    function search(e: any = null) {
        searchValue = formatSearch((e?.target?.value || "").replaceAll(" ", "_"))

        if (searchValue.length < 2) {
            searchedValues = clone(defaultValues)
            return
        }

        let currentValuesList = searchedValues
        // reset if search value changed
        if (!searchValue.includes(previousSearchValue)) currentValuesList = clone(defaultValues)

        searchedValues = {
            search: Object.values(currentValuesList)
                .flat()
                .filter((a) => formatSearch(a.id).includes(searchValue)),
        }

        previousSearchValue = searchValue
    }

    function applyValue(e: any, id: string = "") {
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

            stageShows.update((a) => {
                a[$activeStage.id!].items[activeItemId] = updateItemText(a[$activeStage.id!]?.items[activeItemId])
                return a
            })

            refreshEditSlide.set(true)
            finish()
            return
        }

        if (edit.id) {
            if (edit.type === "overlay") {
                overlays.update((a) => {
                    a[edit.id!].items = updateItemText(a[edit.id!].items)
                    return a
                })
            } else if (edit.type === "template") {
                templates.update((a) => {
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

        showsCache.update((a) => {
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

            lines[caret.line].text.forEach((text) => {
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
    const ref = { showId: $activeShow?.id, layoutId: _show().get("settings.activeLayout"), slideIndex: $activeEdit.slide, type: $activePage === "stage" ? "stage" : $activeEdit.type || "show", id: $activeEdit.id }

    // UPDATE DYNAMIC VALUES e.g. {time_} EVERY SECOND
    let updateDynamic = 0
    const dynamicInterval = setInterval(() => {
        updateDynamic++
    }, 1000)
    onDestroy(() => clearInterval(dynamicInterval))
</script>

<svelte:window on:keydown={applyValue} />

<CombinedInput style="border-bottom: 2px solid var(--secondary);">
    {#key resetInput}
        <TextInput placeholder={$dictionary.main?.search} value="" on:input={search} autofocus />
    {/key}
</CombinedInput>

<div style="position: relative;height: 100%;width: calc(100vw - (var(--navigation-width) + 20px) * 2);overflow-y: auto;">
    {#if Object.values(searchedValues)[0]?.length}
        <div class="list" style={searchValue.length > 1 ? "margin-top: 10px;" : ""}>
            {#each Object.entries(searchedValues) as [key, values]}
                {#if key !== "search"}
                    <HRule title={getTitle(key)} />
                {/if}

                <div class="grid">
                    {#each values as value, i}
                        {@const preview = replaceDynamicValues(`{${value.id}}`, ref, updateDynamic)}
                        <div class="value" class:active={searchValue.length > 1 && i === 0 ? "border: 2px solid var(--secondary-opacity);" : ""} on:click={(e) => applyValue(e, value.id)}>
                            <p class="preview">
                                {#if preview}{preview}{:else}—{/if}
                            </p>

                            <p style="display: inline-flex;">
                                <span style="color: var(--secondary);">{"{"}</span>
                                {value.id}
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

    .preview {
        font-weight: bold;
        font-size: 1.2em;
        text-align: center;
        white-space: initial;
    }
</style>
