<script lang="ts">
    import Button from "../../../common/components/Button.svelte"
    import Center from "../../../common/components/Center.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import { getFileName, removeExtension } from "../../../common/util/media"
    import { translate } from "../../util/helpers"
    import { send } from "../../util/socket"
    import { _set, active, activeProject, activeShow, dictionary, mediaCache, project, projectsOpened, shows } from "../../util/stores"
    import ShowButton from "../ShowButton.svelte"
    import Projects from "./Projects.svelte"
    import type { ShowList } from "../../../../types/Show"

    let editProject = false
    
    function findShow(showId: string): ShowList | null {
        return ($shows as unknown as ShowList[]).find((a) => a.id === showId) || null
    }
    
    // Helper to safely get id from show object
    function getShowId(show: any): string | undefined {
        return show?.id
    }

    function renameProject() {
        const name = prompt("Enter a new name:", $activeProject?.name)
        if (!name) return

        send("API:rename_project", { id: $activeProject?.id, name })
        editProject = false
    }

    function deleteProject() {
        if (!confirm("Are you sure you want to delete this project?")) return

        send("API:delete_project", { id: $activeProject?.id })
        project.set("")
        activeProject.set(null)
        editProject = false
    }

    function removeProjectItem(index: number) {
        const projectId = $activeProject?.id
        if (!projectId) return

        project.set(projectId)
        send("API:remove_project_item", { id: projectId, index })
    }
</script>

{#if $activeProject && !$projectsOpened}
    {#if editProject}
        <div class="list">
            <div class="header">
                <p style="flex: 1;text-align: center;padding: 0.2em 0.8em;">{$activeProject.name}</p>
            </div>

            <!-- shows list -->
            <div class="list">
                {#each $activeProject.shows as show, i}
                    {@const showId = getShowId(show)}
                    {@const s = showId ? findShow(showId) : null}
                    <div class="item">
                        <p style="padding: 4px 8px;">{s?.name || show.name || (showId ? getFileName(removeExtension(showId)) : show.type)}</p>

                        <Button style="padding: 4px 8px;" on:click={() => removeProjectItem(i)} dark>
                            <Icon id="delete" />
                        </Button>
                    </div>
                {/each}
            </div>

            <!-- rename -->
            <Button on:click={renameProject} style="width: 100%;" center dark>
                <Icon id="rename" right />
                <p style="font-size: 0.8em;">{translate("actions.rename", $dictionary)}</p>
            </Button>

            <!-- delete -->
            <Button on:click={deleteProject} style="width: 100%;" center dark>
                <Icon id="delete" right />
                <p style="font-size: 0.8em;">{translate("actions.delete", $dictionary)}</p>
            </Button>
        </div>

        <Button on:click={() => (editProject = false)} style="width: 100%;border-top: 2px solid var(--primary);" center dark>
            <Icon id="back" right />
            <p style="font-size: 0.8em;">{translate("actions.back", $dictionary)}</p>
        </Button>
    {:else}
    <div class="header">
            <div class="header-back">
                <Button on:click={() => _set("projectsOpened", true)}>
                    <Icon id="back" size={1.5} />
                </Button>
            </div>
            <p class="header-title">{$activeProject.name}</p>
            <div class="header-spacer"></div>
        </div>

        {#if $activeProject.shows?.length}
            <div class="scroll project-shows-list">
                {#each $activeProject.shows as show}
                    {@const showId = getShowId(show)}
                    {@const s = showId ? findShow(showId) : null}

                    {#if show.type === "section"}
                        <div class="section">
                            <p style={show.name ? "" : "opacity: 0.5;"}>{show.name || translate("main.unnamed", $dictionary)}</p>
                        </div>
                    {:else if ["image", "video", "overlay", "audio", "pdf"].includes(show.type || "")}
                        <Button
                            on:click={() => {
                                _set("active", show)
                                _set("activeTab", "show")
                                if (showId && ["image", "video"].includes(show.type || "") && !$mediaCache[showId]) send("API:get_thumbnail", { path: showId })
                            }}
                            active={$active.id === showId}
                            bold={false}
                            border
                        >
                            <Icon id={show.type === "audio" ? "music" : show.type === "overlay" ? "overlays" : show.type || ""} right />
                            <span style="display: flex;align-items: center;flex: 1;overflow: hidden;">
                                <p style="margin: 3px 5px;white-space: nowrap;text-overflow: ellipsis;overflow: hidden;">{show.name || (showId ? getFileName(removeExtension(showId)) : "")}</p>
                            </span>
                        </Button>
                    {:else if (show.type || "show") !== "show"}
                        <!-- WIP player / PPT -->
                        <div class="item" style="display: flex;align-items: center;padding: 0.2em 0.8em;">
                            <Icon id={show.type || ""} box={show.type === "ppt" ? 50 : 24} right />
                            <p style="font-size: 0.7em;opacity: 0.5;margin: 3px 5px;text-transform: uppercase;font-size: 0.8em;">{show.type}</p>
                        </div>
                    {:else if s}
                        <ShowButton
                            on:click={(e) => {
                                _set("active", show)
                                _set("activeTab", "show")
                                send("SHOW", e.detail)
                            }}
                            activeShow={($active.type || "show") === "show" && $activeShow}
                            show={s}
                            icon={s.private ? "private" : "slide"}
                        />
                        <!-- s.type || -->
                        <!-- icon: "song" -->
                    {/if}
                {/each}

                {#if ($active.type || "show") === "show" && $activeShow && !$activeProject.shows.find((show) => getShowId(show) === $activeShow?.id)}
                    <Button
                        on:click={() => {
                            project.set($activeProject.id || "")
                            send("API:add_to_project", { projectId: $activeProject.id, id: $activeShow.id })
                        }}
                        style="width: 100%;"
                        dark
                        center
                    >
                        <Icon id="add" right />
                        <p style="font-size: 0.8em;">{translate("context.addToProject", $dictionary)}</p>
                    </Button>
                {/if}
            </div>
        {:else}
            <Center faded>{translate("empty.general", $dictionary)}</Center>

            {#if ($active.type || "show") === "show" && $activeShow}
                <Button
                    on:click={() => {
                        project.set($activeProject.id || "")
                        send("API:add_to_project", { projectId: $activeProject.id, id: $activeShow.id })
                    }}
                    style="width: 100%;"
                    dark
                    center
                >
                    <Icon id="add" right />
                    <p style="font-size: 0.8em;">{translate("context.addToProject", $dictionary)}</p>
                </Button>
            {/if}
        {/if}

        <Button on:click={() => (editProject = true)} center dark class="edit-button">
            <Icon id="edit" size={1.5} right />
            <p>{translate("titlebar.edit", $dictionary)}</p>
        </Button>
    {/if}
{:else}
    <Projects on:open={() => _set("projectsOpened", false)} />
{/if}

<style>
    /* Scroll containers */
    .scroll {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        scrollbar-width: thin;
        scrollbar-color: rgb(255 255 255 / 0.3) rgb(255 255 255 / 0.05);
    }
    .scroll::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }
    .scroll::-webkit-scrollbar-track,
    .scroll::-webkit-scrollbar-corner {
        background: rgb(255 255 255 / 0.05);
    }
    .scroll::-webkit-scrollbar-thumb {
        background: rgb(255 255 255 / 0.3);
        border-radius: 8px;
    }
    .scroll::-webkit-scrollbar-thumb:hover {
        background: rgb(255 255 255 / 0.5);
    }

    .list {
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: auto;
        scrollbar-width: thin;
        scrollbar-color: rgb(255 255 255 / 0.3) rgb(255 255 255 / 0.05);
    }
    .list::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }
    .list::-webkit-scrollbar-track,
    .list::-webkit-scrollbar-corner {
        background: rgb(255 255 255 / 0.05);
    }
    .list::-webkit-scrollbar-thumb {
        background: rgb(255 255 255 / 0.3);
        border-radius: 8px;
    }
    .list::-webkit-scrollbar-thumb:hover {
        background: rgb(255 255 255 / 0.5);
    }

    /* Project shows list - match project list styling */
    .project-shows-list {
        gap: 2px;
    }

    .project-shows-list :global(button) {
        padding: 0.75em 1em;
        min-height: 56px;
        font-size: 1.05em;
        align-items: center;
        justify-content: flex-start;
        text-align: left;
        margin: 0;
    }

    .project-shows-list :global(button) :global(p),
    .project-shows-list :global(button) :global(span) {
        display: flex;
        align-items: center;
        line-height: 1.2;
        text-align: left;
    }

    .project-shows-list :global(button) :global(svg) {
        width: 1.5em;
        height: 1.5em;
        flex-shrink: 0;
    }

    .list .item {
        display: flex;
        justify-content: space-between;

        border-bottom: 1px solid var(--primary-lighter);
    }

    .list .item p {
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
    }

    /* List items */
    .list .item {
        display: flex;
        justify-content: space-between;
        border-bottom: 1px solid var(--primary-lighter);
    }

    .list .item p {
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
    }

    /* Section headers */
    .section {
        text-align: center;
        font-size: 0.75em;
        background-color: var(--primary-darker);
        padding: 2px;
    }

    /* Header layout - match global header style */
    .header {
        display: grid;
        grid-template-columns: 44px 1fr 44px;
        align-items: center;
        position: relative;
        height: 44px; /* match global header height */
    }

    .header-back {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
    }

    .header-title {
        grid-column: 2;
        text-align: center;
        padding: 0;
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .header-spacer {
        grid-column: 3;
        width: 100%;
        height: 100%;
    }

    /* Edit button */
    :global(.edit-button) {
        padding: 1rem 1.5rem;
        font-size: 1em;
        font-weight: 600;
        margin-top: 0.5rem;
        min-height: 48px;
    }

    :global(.edit-button:hover) {
        background-color: var(--hover);
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    /* Mobile styles */
    @media screen and (max-width: 1000px) {
        .project-shows-list {
            gap: 3px;
        }

        .project-shows-list :global(button) {
            padding: 0.9em 1.2em;
            min-height: 60px;
            font-size: 1.15em;
        }

        .project-shows-list :global(button) :global(svg) {
            width: 1.8em;
            height: 1.8em;
        }
    }
</style>
