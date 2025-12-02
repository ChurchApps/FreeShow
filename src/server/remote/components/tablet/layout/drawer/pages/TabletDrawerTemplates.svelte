<script lang="ts">
    import { onMount } from "svelte"
    import type { Template } from "../../../../../../../types/Show"
    import Icon from "../../../../../../common/components/Icon.svelte"
    import Center from "../../../../../../common/components/Center.svelte"
    import { translate } from "../../../../../util/helpers"
    import { send } from "../../../../../util/socket"
    import { dictionary, templates, templateCategories, activeTemplateCategory } from "../../../../../util/stores"
    import MaterialButton from "../../../../MaterialButton.svelte"
    import Zoomed from "../../../../show/Zoomed.svelte"
    import Textbox from "../../../../show/Textbox.svelte"

    export let searchValue: string = ""

    // Resolution for templates preview
    let resolution = { width: 1920, height: 1080 }

    // Get current category
    $: activeCategory = $activeTemplateCategory || "all"

    // Convert templates object to array with IDs
    $: templatesList = Object.entries($templates || {}).map(([id, template]) => ({
        id,
        ...(template as Template)
    }))

    // Filter templates by category
    $: categoryFilteredTemplates = templatesList.filter(template => {
        if (activeCategory === "all") {
            // Exclude archived categories in "all" view
            return !$templateCategories[template.category || ""]?.isArchive
        }
        if (activeCategory === "unlabeled") {
            return template.category === null || !$templateCategories[template.category]
        }
        return template.category === activeCategory
    })

    // Filter templates by search
    $: filteredTemplates = categoryFilteredTemplates.filter(template => {
        if (!searchValue) return true
        return (template.name || "").toLowerCase().includes(searchValue.toLowerCase())
    })

    // Sort templates by name
    $: sortedTemplates = [...filteredTemplates].sort((a, b) => (a.name || "").localeCompare(b.name || ""))

    // Handle template click
    function clickTemplate(templateId: string) {
        send("API:set_template", { id: templateId })
    }

    const ignoreDefault = ["metadata", "message", "double"]

    let isLoading = true
    onMount(() => {
        send("GET_TEMPLATES")

        // Fallback to stop loading if no data comes in
        setTimeout(() => {
            isLoading = false
        }, 1000)
    })

    $: if (templatesList.length > 0) isLoading = false
</script>

<div class="scroll-container">
    <div class="column">
        {#if templatesList.length}
            {#if sortedTemplates.length}
                <div class="grid">
                    {#each sortedTemplates as template (template.id)}
                        <div class="template-card">
                            <MaterialButton style="width: 100%; height: 100%; padding: 0; flex-direction: column; border-radius: 8px; overflow: hidden;" on:click={() => clickTemplate(template.id)} title={template.name || translate("main.unnamed", $dictionary)}>
                                <div class="preview">
                                    <Zoomed center {resolution} background={template.items?.length ? template.settings?.backgroundColor || "var(--primary);" : template.color || "var(--primary);"} checkered={!!template.items?.length && !template.settings?.backgroundColor}>
                                        {#each template.items || [] as item}
                                            <Textbox {item} />
                                        {/each}
                                    </Zoomed>
                                </div>

                                <div class="label">
                                    {#if template.isDefault && !ignoreDefault.includes(template.id)}
                                        <Icon id="protected" style="opacity: 0.6; margin-inline-start: 3px; position: absolute; left: 0;" size={0.6} white />
                                    {/if}
                                    <span class="name">{template.name || translate("main.unnamed", $dictionary)}</span>
                                </div>
                            </MaterialButton>
                        </div>
                    {/each}
                </div>
            {:else}
                <Center faded>{translate("empty.search", $dictionary)}</Center>
            {/if}
        {:else if isLoading}
            <Center faded>{translate("remote.loading", $dictionary)}</Center>
        {:else}
            <Center faded>{translate("empty.general", $dictionary)}</Center>
        {/if}
    </div>
</div>

<style>
    .scroll-container {
        overflow-y: auto;
        flex: 1;
        height: 100%;
    }

    .column {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: var(--primary-darkest);
        padding-bottom: 60px;
    }

    .grid {
        display: flex;
        flex-wrap: wrap;
        padding: 8px;
        gap: 8px;
    }

    .template-card {
        width: calc(20% - 6.4px);
        min-width: 120px;
        /* aspect-ratio: 16/9; */
        border-radius: 8px;
        overflow: hidden;
        position: relative;
        background-color: var(--primary);
        transition: outline 0.15s ease;
        display: flex;
        flex-direction: column;
    }

    .template-card :global(button) {
        background-color: transparent !important;
    }

    .template-card:hover :global(button) {
        background-color: rgb(255 255 255 / 0.05) !important;
    }

    .preview {
        position: relative;
        width: 100%;
        /* flex: 1; */
        aspect-ratio: 16/9;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    }

    .label {
        position: relative;
        display: flex;
        align-items: center;
        background-color: var(--primary-darkest);

        font-size: 0.8em;
        /* font-weight: bold; */

        height: 25px;
        flex: 1;

        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;

        width: 100%;
        text-align: center;
        padding: 4px 5px;
        padding-bottom: 3px;
    }

    .name {
        width: 100%;
        margin: 0 5px;
        text-align: center;
        overflow-x: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* Responsive grid */
    @media (max-width: 600px) {
        .template-card {
            width: calc(33.333% - 6px);
        }
    }

    @media (min-width: 900px) {
        .template-card {
            width: calc(16.666% - 6.7px);
        }
    }

    @media (min-width: 1200px) {
        .template-card {
            width: calc(12.5% - 7px);
        }
    }
</style>
