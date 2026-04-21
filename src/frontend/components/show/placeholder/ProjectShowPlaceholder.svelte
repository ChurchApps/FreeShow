<script lang="ts">
    import { activePopup, activeProject, activeShow, popupData, projects } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Center from "../../system/Center.svelte"

    $: projectId = $activeProject || ""
    $: project = $projects[projectId]

    function replace() {
        popupData.set({
            action: "select_show",
            trigger: (showId: string) => {
                const showTemplateIndex = project.shows?.findIndex((s, i) => s.id === $activeShow?.id && (($activeShow?.index ?? -1) > -1 ? i === $activeShow?.index : true))
                if (showTemplateIndex < 0) return

                projects.update((a) => {
                    if (!a[projectId]) return a

                    a[projectId].shows[showTemplateIndex] = { id: showId, type: "show" }

                    return a
                })

                activeShow.set({ id: showId, type: "show", index: showTemplateIndex })
            }
        })
        activePopup.set("select_show")
    }
</script>

<Center>
    {#if project}
        <MaterialButton variant="contained" icon="slide" style="font-size: 1.1em;" on:click={replace}>
            {translateText("popup.select_show")}
        </MaterialButton>
    {:else}
        <p style="opacity: 0.6;">{translateText("empty.project_select")}</p>
    {/if}
</Center>
