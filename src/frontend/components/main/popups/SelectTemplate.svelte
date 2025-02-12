<script lang="ts">
    import { onMount } from "svelte"
    import { activePopup, dictionary, outputs, popupData, styles, templates } from "../../../stores"
    import { formatSearch } from "../../../utils/search"
    import Card from "../../drawer/Card.svelte"
    import TemplateSlide from "../../drawer/pages/TemplateSlide.svelte"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import { getResolution } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import Center from "../../system/Center.svelte"
    import Loader from "../Loader.svelte"

    $: hideIds = $popupData.hideIds || []
    $: sortedTemplates = sortByName(keysToID($templates).filter((a) => !hideIds.includes(a.id)))

    $: defaultTemplates = clone(sortedTemplates)
    $: if (defaultTemplates) search()

    $: active = $popupData.active || ""

    let searchedTemplates = clone(defaultTemplates)
    let searchValue = ""
    let previousSearchValue: string = ""
    function search(e: any = null) {
        preloader = true
        setTimeout(() => (preloader = false), 20)

        searchValue = formatSearch(e?.target?.value || "")

        if (searchValue.length < 2) {
            searchedTemplates = clone(defaultTemplates)
            return
        }

        let currentTemplatesList = searchedTemplates
        // reset if search value changed
        if (!searchValue.includes(previousSearchValue)) currentTemplatesList = clone(defaultTemplates)

        searchedTemplates = currentTemplatesList.filter((a) => formatSearch(a.name || "").includes(searchValue))

        previousSearchValue = searchValue
    }

    function selectTemplate(template: any) {
        if ($popupData.action !== "select_template") return

        if ($popupData.trigger) {
            $popupData.trigger(template.id)
            // } else {
            //     popupData.set({ ...$popupData, templateId: template.id })
        }

        activePopup.set($popupData.revert || null)
    }

    let resolution = getResolution(null, { $outputs, $styles })

    function chooseTemplate(e: any) {
        if (e.key !== "Enter" || !searchValue.length || !searchedTemplates.length) return
        selectTemplate(searchedTemplates[0])
    }

    // open drawer tab instantly before content has loaded
    let preloader: boolean = true
    onMount(() => setTimeout(() => (preloader = false), 20))
</script>

<svelte:window on:keydown={chooseTemplate} />

<CombinedInput style="border-bottom: 2px solid var(--secondary);">
    <TextInput placeholder={$dictionary.main?.search} value="" on:input={search} autofocus />
</CombinedInput>

<div style="position: relative;height: 100%;width: calc(100vw - (var(--navigation-width) + 20px) * 2);overflow-y: auto;">
    {#if preloader && sortedTemplates.length > 10}
        <Center style="height: 100px;padding-top: 20px;">
            <Loader />
        </Center>
    {:else if searchedTemplates.length}
        <div class="grid">
            {#each searchedTemplates as template, i}
                <Card preview={!!(searchValue.length && i === 0)} active={active === template.id} label={template.name} color={template.color} {resolution} on:click={() => selectTemplate(template)}>
                    <TemplateSlide templateId={template.id} {template} preview />
                </Card>
            {/each}
        </div>
    {:else}
        <Center size={1.2} faded style="height: 100px;padding-top: 20px;">
            {#if sortedTemplates.length}
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
</style>
