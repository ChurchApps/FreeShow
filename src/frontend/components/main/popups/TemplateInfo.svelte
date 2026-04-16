<script lang="ts">
    import { activeEdit, activePage, activePopup, activeShow, activeStyle, alertMessage, categories, groups, settingsTab, showsCache, special, styles, templates } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import { allOutputsHasStyleTemplate, getFirstActiveOutput } from "../../helpers/output"
    import { getLayoutRef, removeTemplatesFromShow } from "../../helpers/show"
    import { _show } from "../../helpers/shows"
    import HRule from "../../input/HRule.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    const showId = $activeShow?.id || ""
    const currentShow = $showsCache[showId]

    const referenceType = currentShow?.reference?.type
    const isScripture = referenceType === "scripture"

    const outputStyleId = getFirstActiveOutput()?.style || ""
    const outputStyleTemplate = allOutputsHasStyleTemplate(isScripture) ? $styles[outputStyleId]?.[isScripture ? "templateScripture" : "template"] || "" : ""
    const enableStylePreview = !!(outputStyleTemplate && $special.styleTemplatePreview !== false && $templates[outputStyleTemplate])

    const ref = showId && currentShow ? getLayoutRef(showId) : []

    const Slide = $activeEdit.slide !== null && ref?.[$activeEdit.slide!] ? _show(showId).slides([ref[$activeEdit.slide!]?.id]).get()?.[0] : null
    const slideTemplate = Slide?.settings?.template

    const parentId = $activeEdit.slide !== null && ref?.[$activeEdit.slide!] ? ref[$activeEdit.slide!]?.parent?.id || ref[$activeEdit.slide!]?.id : ""
    const slideGroup = _show(showId).slides([parentId]).get()?.[0]?.globalGroup || ""
    const groupTemplate = $groups[slideGroup]?.template

    const showTemplateId = currentShow?.settings?.template || ""
    const showTemplateIcon = !!(showTemplateId && $templates[showTemplateId])
    let enableShowTemplate = showTemplateIcon && (!referenceType || referenceType === "scripture" || open)

    function openStylePage() {
        activeStyle.set(outputStyleId)
        settingsTab.set("styles")
        activePage.set("settings")
        // scroll to bottom
        setTimeout(() => {
            document.querySelector(".row")?.querySelector(".center")?.querySelector(".scroll")?.scrollTo(0, 1000)
        }, 80)

        activePopup.set(null)
    }

    function editTemplate(templateId: string) {
        activeEdit.set({ type: "template", id: templateId, items: [] })
        activePage.set("edit")

        activePopup.set(null)
    }

    function removeShowTemplate() {
        // alert if show category has a template
        const categoryId = $showsCache[showId]?.category || ""
        const categoryTemplate = $categories[categoryId]?.template || ""
        if (categoryTemplate) {
            alertMessage.set("tips.category_template")
            activePopup.set("alert")
            return
        }

        removeTemplatesFromShow(showId, "", true)
        enableShowTemplate = false
        activePopup.set(null)
    }
</script>

{#if enableStylePreview}
    <!-- Output has a style template. -->
    <p><b>{translateText("edit.style")}:</b> {translateText(`settings.override${isScripture ? "_scripture" : ""}_with_template`)}</p>

    <div class="flex">
        <MaterialButton style="flex: 1;" variant="outlined" title="menu.edit: {$templates[outputStyleTemplate]?.name || ''}" on:click={() => editTemplate(outputStyleTemplate)}>
            <Icon size={1.1} id="edit" />
            <p>{translateText("menu.edit")}: <b>{$templates[outputStyleTemplate]?.name || ""}</b></p>
        </MaterialButton>

        <MaterialButton style="flex: 1;" variant="outlined" title="edit.style: {$styles[outputStyleId]?.name || ''}" on:click={openStylePage}>
            <Icon size={1.1} id="styles" />
            <p>{translateText("edit.style")}: <b>{$styles[outputStyleId]?.name || ""}</b></p>
        </MaterialButton>
    </div>
{/if}

{#if enableStylePreview && (slideTemplate || groupTemplate || enableShowTemplate)}
    <HRule />
{/if}

{#if $activePage === "edit"}
    {#if slideTemplate}
        <p><b>{translateText("tools.slide")}:</b><!-- {translateText("formats.template")} --></p>

        <div class="flex">
            <MaterialButton style="flex: 1;" variant="outlined" title="menu.edit: {$templates[slideTemplate]?.name || ''}" on:click={() => editTemplate(slideTemplate)}>
                <Icon size={1.1} id="edit" />
                <p>{translateText("menu.edit")}: <b>{$templates[slideTemplate]?.name || ""}</b></p>
            </MaterialButton>
        </div>
    {/if}

    {#if groupTemplate}
        <p style={slideTemplate ? "margin-top: 10px;" : ""}><b>{translateText("inputs.group")}:</b><!-- {translateText("formats.template")} --></p>

        <div class="flex">
            <MaterialButton style="flex: 1;" variant="outlined" title="menu.edit: {$templates[groupTemplate]?.name || ''}" on:click={() => editTemplate(groupTemplate)}>
                <Icon size={1.1} id="edit" />
                <p>{translateText("menu.edit")}: <b>{$templates[groupTemplate]?.name || ""}</b></p>
            </MaterialButton>

            <MaterialButton style="flex: 1;" variant="outlined" title="popup.manage_groups" on:click={() => activePopup.set("manage_groups")}>
                <Icon size={1.1} id="groups" />
                <p>{translateText("popup.manage_groups")}</p>
            </MaterialButton>
        </div>
    {/if}

    {#if (slideTemplate || groupTemplate) && enableShowTemplate}
        <HRule />
    {/if}
{:else}
    <!-- Individual slides/groups can also have another template -->
{/if}

{#if enableShowTemplate}
    <!-- Show has a template. -->
    <p><b>{translateText("formats.show")}:</b><!-- {translateText("formats.template")} --></p>

    <div class="flex">
        <MaterialButton style="flex: 1;" variant="outlined" title="menu.edit: <b>{$templates[showTemplateId]?.name || 'info.template'}</b>" on:click={() => editTemplate(showTemplateId)}>
            <Icon size={1.1} id="edit" />
            <p>{translateText("menu.edit")}: <b>{$templates[showTemplateId]?.name || "info.template"}</b></p>
        </MaterialButton>

        <MaterialButton style="flex: 1;" variant="outlined" title="actions.remove_template_from_show" on:click={removeShowTemplate}>
            <Icon size={1.1} id="remove_circle" />
            <p>{translateText("actions.remove_template_from_show")}</p>
        </MaterialButton>
    </div>
{/if}

<style>
    .flex {
        display: flex;
        gap: 5px;
        margin-top: 5px;
    }
</style>
