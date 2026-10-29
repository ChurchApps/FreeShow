<script lang="ts">
    import { activePopup, activeProject, activeShow, editingProjectTemplate, popupData, projects, projectTemplates, shows } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { history } from "../../helpers/history"
    import { linkProjectItemTo } from "../../helpers/projectItemLink"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Center from "../../system/Center.svelte"
    import DropArea from "../../system/DropArea.svelte"

    $: isTemplate = !!$editingProjectTemplate
    $: projectId = isTemplate ? $editingProjectTemplate : $activeProject || ""
    $: project = isTemplate ? $projectTemplates[projectId] : $projects[projectId]

    $: activeItem = project?.shows?.find((s, i) => s.id === $activeShow?.id && (($activeShow?.index ?? -1) > -1 ? i === $activeShow?.index : true))
    $: selectedShowId = activeItem?.type === "show_placeholder" ? activeItem.data?.showId || "" : ""
    $: selectedShowName = selectedShowId ? $shows[selectedShowId]?.name || "" : ""

    function selectShow() {
        popupData.set({
            action: "select_show",
            active: selectedShowId,
            trigger: (showId: string) => {
                const showTemplateIndex = project.shows?.findIndex((s, i) => s.id === $activeShow?.id && (($activeShow?.index ?? -1) > -1 ? i === $activeShow?.index : true))
                if (showTemplateIndex < 0) return

                const newShows = [...(project?.shows || [])]
                if (isTemplate) {
                    newShows[showTemplateIndex] = {
                        ...newShows[showTemplateIndex],
                        data: { ...(newShows[showTemplateIndex].data || {}), showId }
                    }
                    history({
                        id: "UPDATE",
                        newData: { key: "shows", data: newShows },
                        oldData: { id: projectId },
                        location: { page: "show", id: "project_template" }
                    })
                } else {
                    linkProjectItemTo(showTemplateIndex, showId, projectId)
                }
            }
        })
        activePopup.set("select_show")
    }

    function removeSelectedShow() {
        const showTemplateIndex = project.shows?.findIndex((s, i) => s.id === $activeShow?.id && (($activeShow?.index ?? -1) > -1 ? i === $activeShow?.index : true))
        if (showTemplateIndex < 0) return

        const newShows = [...(project?.shows || [])]
        const newData = { ...(newShows[showTemplateIndex].data || {}) }
        delete newData.showId
        newShows[showTemplateIndex] = {
            ...newShows[showTemplateIndex],
            data: newData
        }

        history({
            id: "UPDATE",
            newData: { key: "shows", data: newShows },
            oldData: { id: projectId },
            location: { page: "show", id: "project_template" }
        })
    }
</script>

<DropArea id="project" hoverTimeout={150}>
    <Center>
        {#if project}
            <div style="display: flex;gap: 4px;">
                <MaterialButton variant={isTemplate ? "outlined" : "contained"} icon="slide" style="font-size: 1.1em;" on:click={selectShow}>
                    {#if selectedShowName}
                        {translateText("actions.duplicate")}: <span style="font-weight: normal;">{selectedShowName}</span>
                    {:else}
                        {translateText("popup.select_show")}

                        {#if isTemplate}
                            <span style="font-style: italic;font-size: 0.9em;opacity: 0.6;font-weight: normal;">{translateText("actions.duplicate")}</span>
                        {/if}
                    {/if}
                </MaterialButton>
                {#if isTemplate && selectedShowId}
                    <MaterialButton variant="outlined" icon="clear" title="clear.general" on:click={removeSelectedShow} />
                {/if}
            </div>
        {:else}
            <p style="opacity: 0.6;">{translateText("empty.project_select")}</p>
        {/if}
    </Center>
</DropArea>
