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

    // sort by newest first - avoid mutating original array
    $: sortedProjects = [...$projects].sort((a, b) => (b.used || 0) - (a.used || 0))

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

<div class="scroll project-list">
    {#if sortedProjects.length}
        <!-- <Projects {folders} {projects} activeProject={project} bind:activeShow {openedFolders} /> -->
        {#each sortedProjects as project (project.id)}
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

<Button on:click={createProject} center dark class="new-project-button">
    <Icon id="add" size={1.5} right />
    <p>{translate("new.project", $dictionary)}</p>
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

    /* Project list - reduce spacing between items */
    .project-list {
        gap: 2px;
    }

    /* Project button styling - left aligned */
    :global(.project-list) :global(button) {
        padding: 0.75em 1em;
        min-height: 56px;
        font-size: 1.05em;
        align-items: center;
        justify-content: flex-start;
        text-align: left;
        margin: 0;
    }
    :global(.project-list) :global(button) :global(span) {
        display: flex;
        align-items: center;
        line-height: 1.2;
        text-align: left;
    }

    /* Mobile: Make everything bigger */
    @media screen and (max-width: 1000px) {
        .header {
            font-size: 1.2em;
            padding: 0.6em 0;
        }

        :global(.project-list) :global(button) {
            padding: 0.9em 1.2em;
            min-height: 60px;
            font-size: 1.15em;
        }
        .project-list {
            gap: 3px;
        }
    }

    /* New project button styling - matches edit button */
    :global(.new-project-button) {
        padding: 1rem 1.5rem !important;
        font-size: 1em !important;
        font-weight: 600 !important;
        margin-top: 0.5rem;
        min-height: 48px;
    }
    :global(.new-project-button:hover) {
        background-color: var(--hover) !important;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
</style>
