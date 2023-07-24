<script lang="ts">
    import type { Tree } from "../../../types/Projects"
    import { activeProject, activeShow, dictionary, drawer, folders, labelsDisabled, projects, projectView } from "../../stores"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import { getFileName, removeExtension } from "../helpers/media"
    import { checkInput } from "../helpers/showActions"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    // import ProjectsFolder from "../inputs/ProjectsFolder.svelte"
    import ShowButton from "../inputs/ShowButton.svelte"
    import { autoscroll } from "../system/autoscroll"
    import Autoscroll from "../system/Autoscroll.svelte"
    import Center from "../system/Center.svelte"
    import DropArea from "../system/DropArea.svelte"
    import SelectElem from "../system/SelectElem.svelte"
    import ProjectList from "./ProjectList.svelte"

    let tree: Tree[] = []
    $: f = Object.entries($folders).map(([id, folder]) => ({ ...folder, id, type: "folder" as "folder" }))
    $: p = Object.entries($projects).map(([id, project]) => ({ ...project, id, shows: [] as any }))
    $: {
        tree = [...f.sort((a, b) => a.name?.localeCompare(b.name)), ...p.sort((a, b) => a.name?.localeCompare(b.name))]

        folderSorted = []
        sortFolders()
        tree = folderSorted
    }

    let folderSorted: Tree[] = []
    function sortFolders(parent: string = "/", index: number = 0, path: string = "") {
        let filtered = tree.filter((a: any) => a.parent === parent).map((a) => ({ ...a, index, path }))
        filtered.forEach((folder) => {
            folderSorted.push(folder)
            if (folder.type === "folder") {
                sortFolders(folder.id, index + 1, path + folder.id + "/")
            }
        })
    }

    // autoscroll
    let scrollElem: any
    let offset: number = -1
    $: itemsBefore = $drawer.height < 400 ? 5 : 1
    $: offset = autoscroll(scrollElem, Math.max(0, ($activeShow?.index || 0) - itemsBefore))

    // close if not existing
    $: if ($activeProject && !$projects[$activeProject]) activeProject.set(null)
    $: {
        // get pos if clicked in drawer
        if ($activeProject && $activeShow?.index !== undefined && $projects[$activeProject]?.shows[$activeShow.index]?.id !== $activeShow?.id) findShowInProject()
    }

    function findShowInProject() {
        let i = $projects[$activeProject!].shows.findIndex((p) => p.id === $activeShow?.id)
        let pos: number = i > -1 ? i : $activeShow?.index || -1

        // ($activeShow?.type !== "video" && $activeShow?.type !== "image")
        if (pos < 0 || $activeShow?.index === pos) return

        activeShow.update((a) => {
            a!.index = pos
            return a
        })
    }

    activeProject.subscribe(loadProjectShows)
    function loadProjectShows(a: null | string) {
        if (!a || !$projects[a]) {
            activeProject.set(null)
            projectView.set(true)
            return
        }

        // load all shows in a project (this was not good when changing many projects)
        // if ($loaded) {
        //     loadShows($projects[a].shows.filter((a) => a.type === undefined || a.type === "show").map((a) => a.id))
        // }
        // TODO: CHECK VIDEOS
    }

    // pre v0.6.1
    $: if ($activeProject && $projects[$activeProject]?.notes !== undefined) moveNotes()
    function moveNotes() {
        projects.update((a) => {
            let notes: string = a[$activeProject!].notes || ""
            if (notes.length) a[$activeProject!].shows.splice(0, 0, { id: "notes", type: "section", name: "Notes", notes })

            delete a[$activeProject!].notes
            return a
        })
    }

    function addSection() {
        let activeShowIndex = $activeShow?.index !== undefined ? $activeShow?.index + 1 : null
        let index: number = activeShowIndex ?? $projects[$activeProject || ""]?.shows?.length ?? 0
        history({ id: "UPDATE", newData: { key: "shows", index }, oldData: { id: $activeProject }, location: { page: "show", id: "section" } })
    }
</script>

<svelte:window on:keydown={checkInput} />

<div class="main">
    <span class="tabs">
        <!-- TODO: set different project system folders.... -->
        <!-- TODO: right click change... -->
        <Button style="flex: 1" on:click={() => projectView.set(true)} active={$projectView} center dark title={$dictionary.remote?.projects}>
            <Icon id="folder" size={1.2} right />
            <!-- ={!$labelsDisabled} -->
            <!-- {#if !$labelsDisabled}
                <T id="remote.projects" />
            {/if} -->
        </Button>
        <!-- TODO: right click go to recent -->
        <Button
            style="flex: 5;"
            on:click={() => projectView.set(false)}
            class="context #projectTab _close"
            active={!$projectView}
            bold={false}
            dark
            center
            disabled={$activeProject === null}
            title={$activeProject ? $dictionary.remote?.project + ": " + $projects[$activeProject]?.name : ""}
        >
            <Icon id="project" right />
            <p style="color: white; overflow: hidden;">{$activeProject ? $projects[$activeProject]?.name : ""}</p>
        </Button>
        <!-- <button onClick={() => setProject(true)} style={{width: '50%', backgroundColor: (project ? 'transparent' : ''), color: (project ? 'var(--secondary)' : '')}}>Projects</button>
    <button onClick={() => setProject(false)} style={{width: '50%', backgroundColor: (project ? '' : 'transparent'), color: (project ? '' : 'var(--secondary)')}}>Timeline</button> -->
    </span>
    {#if $projectView}
        <div class="list projects context #projects" style="overflow: auto;">
            <DropArea id="projects">
                <ProjectList {tree} />
                <!-- <ProjectsFolder id="/" name="All Projects" {tree} opened index={0} /> -->
            </DropArea>
        </div>
        <div class="tabs">
            <Button on:click={() => history({ id: "UPDATE", newData: { replace: { parent: $projects[$activeProject || ""]?.parent || "/" } }, location: { page: "show", id: "project_folder" } })} center title={$dictionary.new?.folder}>
                <Icon id="folder" right={!$labelsDisabled} />
                {#if !$labelsDisabled}<T id="new.folder" />{/if}
            </Button>
            <Button on:click={() => history({ id: "UPDATE", newData: { replace: { parent: $projects[$activeProject || ""]?.parent || "/" } }, location: { page: "show", id: "project" } })} center title={$dictionary.new?.project}>
                <Icon id="project" right={!$labelsDisabled} />
                {#if !$labelsDisabled}<T id="new.project" />{/if}
            </Button>
        </div>
    {:else if $activeProject !== null}
        <div class="list context #project">
            <Autoscroll {offset} bind:scrollElem timeout={150}>
                <DropArea id="project" selectChildren let:fileOver file>
                    <!-- {/* WIP: live on double click?? */} -->
                    {#if $projects[$activeProject]?.shows.length}
                        {#each $projects[$activeProject]?.shows as show, index}
                            <!-- + ($activeShow?.type === "show" && $activeShow?.id === show.id ? " active" : "")} on:click={() => activeShow.set(show)} -->
                            <!-- <ShowButton {...show} name={$shows[show.id]?.name} category={[$shows[show.id]?.category, true]} /> -->
                            <SelectElem id="show" data={{ ...show, name: show.name || removeExtension(getFileName(show.id)), index }} {fileOver} borders="edges" trigger="column" draggable>
                                {#if show.type === "section"}
                                    <Button active={$activeShow?.id === show.id} class="section context #project_section__project" on:click={() => activeShow.set({ ...show, index })} dark center bold={false}>
                                        {#if show.name?.length}
                                            {show.name}
                                        {:else}
                                            <span style="opacity: 0.5;"><T id="main.unnamed" /></span>
                                        {/if}
                                    </Button>
                                {:else}
                                    <ShowButton id={show.id} {show} {index} class="context #project_{show.type ? (show.type === 'video' || show.type === 'image' ? 'media' : show.type) : 'show'}__project" icon />
                                {/if}
                            </SelectElem>
                            <!-- <button class="listItem" type={show.type} on:click={() => setFreeShow({...freeShow, activeSong: obj.name})} onDoubleClick={() => setLive({type: obj.type, name: obj.name, slide: 0})}>{show.name}</button> -->
                        {/each}
                    {:else}
                        <Center faded>
                            <T id="empty.shows" />
                        </Center>
                    {/if}
                </DropArea>
            </Autoscroll>
        </div>
        <!-- <div class="tabs">
      <Button on:click={() => newShow()} center title={$dictionary.new?.show}>
        <Icon id="showIcon" />
      </Button>
      <Button on:click={() => newShow(true)} center title={$dictionary.new?.private}>
        <Icon id="private" />
      </Button>
    </div> -->
    {:else}
        <Center faded>
            <T id="empty.project_select" />
        </Center>
    {/if}
</div>
{#if $activeProject && !$projectView}
    <div class="tabs">
        <Button style="width: 100%;" title={$dictionary.new?.section} on:click={addSection} center>
            <Icon id="section" right={!$labelsDisabled} />
            {#if !$labelsDisabled}<T id="new.section" />{/if}
        </Button>
    </div>
{/if}

<style>
    .main {
        /* max-height: 50%; */
        /* width: 100%; */
        position: relative;
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
    }

    .tabs {
        display: flex;
        background-color: var(--primary-darker);
        /* width: 100%;
    justify-content: space-between; */
    }
    .tabs :global(button) {
        width: 50%;
    }

    .list {
        position: relative;
        display: flex;
        flex-direction: column;
        /* overflow-y: auto;
    overflow-x: hidden; */
        overflow: hidden;
        height: 100%;
    }

    .list.projects :global(.droparea) {
        /* this is to be able to right click and add a folder/project at "root" level */
        padding-bottom: 10px;
    }

    .list :global(.section) {
        padding: 4px 40px;
        font-size: 0.8em;
        /* font-weight: bold; */
        width: 100%;
    }
    .list :global(.section.active) {
        outline-offset: -2px;
        outline: 2px solid var(--primary-lighter);
    }
</style>
