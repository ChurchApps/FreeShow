<script lang="ts">
    import { onMount } from "svelte"
    import type { Template } from "../../../../types/Show"
    import { activeEdit, activePage, activePopup, activeShow, alertMessage, labelsDisabled, mediaOptions, outputs, selected, showsCache, styles, templateCategories, templates } from "../../../stores"
    import { getAccess } from "../../../utils/profile"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getResolution } from "../../helpers/output"
    import { deselect } from "../../helpers/select"
    import { getLayoutRef } from "../../helpers/show"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Loader from "../../main/Loader.svelte"
    import Actions from "../../slide/Actions.svelte"
    import Center from "../../system/Center.svelte"
    import DropArea from "../../system/DropArea.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import Card from "../Card.svelte"
    import TemplateSlide from "./TemplateSlide.svelte"
    import { translateText } from "../../../utils/language"

    export let active: string | null
    export let searchValue = ""

    const profile = getAccess("templates")
    $: readOnly = profile.global === "read" || profile[active || ""] === "read"

    $: resolution = getResolution(null, { $outputs, $styles }) // $templates[active || ""]?.settings?.resolution
    let filteredTemplates: (Template & { id: string })[] = []

    $: activeTemplate = ($activeShow && $activeShow.type === undefined) || $activeShow?.type === "show" ? $showsCache[$activeShow.id]?.settings?.template : null

    let fullFilteredTemplates: (Template & { id: string })[] = []
    $: if ($templates || active || $templateCategories) updateTemplates()

    function updateTemplates() {
        filteredTemplates = sortByName(
            keysToID(clone($templates)).filter((s) => (active === "all" && !$templateCategories[s?.category || ""]?.isArchive) || active === s.category || (active === "unlabeled" && (s.category === null || !$templateCategories[s.category])))
        )

        filterSearch()
    }

    // search
    $: if (searchValue !== undefined) filterSearch()
    const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~()]/g, "")
    function filterSearch() {
        fullFilteredTemplates = clone(filteredTemplates)
        if (searchValue.length > 1) fullFilteredTemplates = fullFilteredTemplates.filter((a) => filter(a.name).includes(filter(searchValue)))
    }

    let nextScrollTimeout: NodeJS.Timeout | null = null
    function wheel(e: any) {
        if (!e.ctrlKey && !e.metaKey) return
        if (nextScrollTimeout) return

        mediaOptions.set({ ...$mediaOptions, columns: Math.max(2, Math.min(10, $mediaOptions.columns + (e.deltaY < 0 ? -100 : 100) / 100)) })

        // don't start timeout if scrolling with mouse
        if (e.deltaY >= 100 || e.deltaY <= -100) return
        nextScrollTimeout = setTimeout(() => {
            nextScrollTimeout = null
        }, 500)
    }

    // open drawer tab instantly before content has loaded
    let preloader = true
    onMount(() => setTimeout(() => (preloader = false), 20))

    const ignoreDefault = ["metadata", "message", "double"]

    $: templateWithNonExistentCategory = active === "unlabeled" && filteredTemplates.some((s) => s.category)
    function createNonExistentCategories() {
        const nonexistentCategories = [...new Set(filteredTemplates.map((s) => s.category))].filter((c) => c && !$templateCategories[c]) as string[]

        templateCategories.update((a) => {
            nonexistentCategories.forEach((id) => {
                if (a[id]) return
                a[id] = { name: translateText("main.unnamed") }
            })
            return a
        })
    }
</script>

<div style="position: relative;height: 100%;overflow-y: auto;" on:wheel={wheel}>
    <DropArea id="templates">
        {#if preloader && fullFilteredTemplates.length > 10}
            <Center>
                <Loader />
            </Center>
        {:else if fullFilteredTemplates.length}
            <div class="grid" style="--width: {100 / $mediaOptions.columns}%;">
                {#each fullFilteredTemplates as template}
                    {@const isReadOnly = readOnly || profile[template.category || ""] === "read"}

                    <SelectElem id="template" data={template.id} class="context #template_card{template.isDefault && !ignoreDefault.includes(template.id) && !isReadOnly ? '_default' : ''}{isReadOnly ? '_readonly' : ''}" draggable fill>
                        <Card
                            width={100}
                            preview={$activePage === "edit" && $activeEdit.type === "template" && $activeEdit.id === template.id}
                            active={template.id === activeTemplate}
                            label={template.name}
                            renameId="template_{template.id}"
                            icon={template.isDefault ? "protected" : null}
                            color={template.color}
                            {resolution}
                            on:click={(e) => {
                                if (e.target?.closest(".edit") || e.target?.closest(".icons")) return
                                if (!$activeShow || ($activeShow?.type || "show") !== "show" || e.ctrlKey || e.metaKey) return

                                if ($showsCache[$activeShow.id]?.locked) {
                                    alertMessage.set("show.locked_info")
                                    activePopup.set("alert")
                                    return
                                }

                                const profile = getAccess("shows")
                                const readOnly = profile.global === "read" || profile[$showsCache[$activeShow.id]?.category || ""] === "read"
                                if (readOnly) {
                                    alertMessage.set("profile.locked")
                                    activePopup.set("alert")
                                    return
                                }

                                // one selected slides
                                let ref = getLayoutRef()
                                if ($selected.id === "slide" && $selected.data.length < ref.length) {
                                    $selected.data.forEach(({ index, showId }) => {
                                        let slideId = ref[index]?.id
                                        let slideSettings = _show(showId || "active")
                                            .slides([slideId])
                                            .get("settings")
                                        let oldData = { style: clone(slideSettings) }
                                        let newData = { style: { ...clone(slideSettings), template: template.id } }

                                        // WIP apply to all slides at once...
                                        history({
                                            id: "slideStyle",
                                            oldData,
                                            newData,
                                            location: { page: "edit", show: $activeShow, slide: slideId }
                                        })
                                    })

                                    deselect()
                                    // WIP refresh slides (apply template)
                                    return
                                }

                                history({ id: "TEMPLATE", newData: { id: template.id, data: { createItems: true, shiftItems: e.shiftKey } }, location: { page: "none", override: "show#" + $activeShow.id } })
                            }}
                        >
                            <!-- icons -->
                            {#if template.settings?.actions?.length}
                                <Actions columns={$mediaOptions.columns} templateId={template.id} actions={{ slideActions: template.settings?.actions }} />
                            {/if}

                            <TemplateSlide templateId={template.id} {template} preview />
                        </Card>
                    </SelectElem>
                {/each}
            </div>
        {:else}
            <Center size={1.2} faded>
                {#if filteredTemplates.length}
                    <T id="empty.search" />
                {:else}
                    <T id="empty.general" />
                {/if}
            </Center>
        {/if}
    </DropArea>
</div>

{#if templateWithNonExistentCategory}
    <FloatingInputs side="left" onlyOne>
        <MaterialButton icon="autofill" on:click={createNonExistentCategories}>
            <T id="category.create_nonexistent" />
        </MaterialButton>
    </FloatingInputs>
{/if}

<FloatingInputs onlyOne>
    <MaterialButton disabled={readOnly} icon="add" title="new.template" on:click={() => history({ id: "UPDATE", location: { page: "drawer", id: "template" } })}>
        {#if !$labelsDisabled}<T id="new.template" />{/if}
    </MaterialButton>
</FloatingInputs>

<style>
    .grid {
        display: flex;
        flex-wrap: wrap;
        flex: 1;
        padding: 5px;
        place-content: flex-start;

        padding-bottom: 60px;
    }

    .grid :global(.selectElem) {
        width: var(--width);
        outline-offset: -3px;
    }
    .grid :global(.isSelected) {
        border-radius: 0 !important;
    }
</style>
