<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import Center from "../../../common/components/Center.svelte"
    import { translate } from "../../util/helpers"
    import { _set, activeProject, dictionary, projects } from "../../util/stores"
    import ProjectButton from "../ProjectButton.svelte"

    let dispatch = createEventDispatcher()

    // sort by newest first
    $: sortedProjects = $projects.sort((a, b) => b.used - a.used)
</script>

<h2 class="header">{translate("remote.projects", $dictionary)}</h2>

<div class="scroll">
    {#if sortedProjects.length}
        <!-- <Projects {folders} {projects} activeProject={project} bind:activeShow {openedFolders} /> -->
        {#each sortedProjects as project}
            <ProjectButton
                active={$activeProject?.id === project.id}
                name={project.name}
                on:click={() => {
                    _set("activeProject", project)
                    dispatch("open")
                }}
            />
        {/each}
    {:else}
        <Center faded>{translate("empty.project_select", $dictionary)}</Center>
    {/if}
</div>

<style>
    .scroll {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }
</style>
