<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import Center from "../../../common/components/Center.svelte"
    import { translate } from "../../util/helpers"
    import { _set, activeProject, dictionary, projects } from "../../util/stores"
    import ProjectButton from "../ProjectButton.svelte"

    let dispatch = createEventDispatcher()
</script>

<h2 class="header">{translate("remote.projects", $dictionary)}</h2>

{#if $projects.length}
    <!-- <Projects {folders} {projects} activeProject={project} bind:activeShow {openedFolders} /> -->
    {#each $projects as project}
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
