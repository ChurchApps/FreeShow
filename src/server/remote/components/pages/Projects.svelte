<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { uid } from "uid"
    import Button from "../../../common/components/Button.svelte"
    import Center from "../../../common/components/Center.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import { translate } from "../../util/helpers"
    import { send } from "../../util/socket"
    import { _set, activeProject, dictionary, project, projects, projectsOpened } from "../../util/stores"
    import ProjectButton from "../ProjectButton.svelte"

    let dispatch = createEventDispatcher()

    // sort by newest first
    $: sortedProjects = $projects.sort((a, b) => b.used - a.used)

    function createProject() {
        const name = prompt("Please enter a name:")
        if (!name) return

        const projectId = uid()
        send("API:create_project", { name, id: projectId })

        projectsOpened.set(false)
        project.set(projectId)
    }
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

<Button on:click={createProject} center dark>
    <Icon id="add" right />
    <p style="font-size: 0.8em;">{translate("new.project", $dictionary)}</p>
</Button>

<style>
    .scroll {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        /* FreeShow UI scrollbar */
        scrollbar-width: thin; /* Firefox */
        scrollbar-color: rgb(255 255 255 / 0.3) rgb(255 255 255 / 0.05);
    }
    .scroll::-webkit-scrollbar { width: 8px; height: 8px; }
    .scroll::-webkit-scrollbar-track,
    .scroll::-webkit-scrollbar-corner { background: rgb(255 255 255 / 0.05); }
    .scroll::-webkit-scrollbar-thumb { background: rgb(255 255 255 / 0.3); border-radius: 8px; }
    .scroll::-webkit-scrollbar-thumb:hover { background: rgb(255 255 255 / 0.5); }
</style>
