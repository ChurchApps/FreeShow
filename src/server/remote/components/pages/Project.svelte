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

    let editProject = false

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
        send("API:remove_project_item", { id: $activeProject?.id, index })
    }
</script>

{#if $activeProject && !$projectsOpened}
    {#if editProject}
        <div class="list">
            <div class="header" style="padding: 0;">
                <p style="flex: 1;text-align: center;padding: 0.2em 0.8em;">{$activeProject.name}</p>
            </div>

            <!-- shows list -->
            <div class="list">
                {#each $activeProject.shows as show, i}
                    {@const s = $shows.find((a) => a.id === show.id) || null}
                    <div class="item">
                        <p style="padding: 4px 8px;">{s?.name || show.name || (show.id ? getFileName(removeExtension(show.id)) : show.type)}</p>

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
        <div class="header" style="padding: 0;">
            <Button on:click={() => _set("projectsOpened", true)}>
                <Icon id="back" size={1.5} />
            </Button>
            <p style="flex: 1;text-align: center;padding: 0.2em 0.8em;">{$activeProject.name}</p>
        </div>

        {#if $activeProject.shows?.length}
            <div class="scroll">
                {#each $activeProject.shows as show}
                    {@const s = $shows.find((a) => a.id === show.id) || null}

                    {#if show.type === "section"}
                        <div class="section">
                            <p style={show.name ? "" : "opacity: 0.5;"}>{show.name || translate("main.unnamed", $dictionary)}</p>
                        </div>
                    {:else if ["image", "video", "overlay", "audio", "pdf"].includes(show.type || "")}
                        <Button
                            on:click={() => {
                                _set("active", show)
                                _set("activeTab", "show")
                                if (["image", "video"].includes(show.type || "") && !$mediaCache[show.id]) send("API:get_thumbnail", { path: show.id })
                            }}
                            active={$active.id === show.id}
                            bold={false}
                            border
                        >
                            <Icon id={show.type === "audio" ? "music" : show.type === "overlay" ? "overlays" : show.type || ""} right />
                            <span style="display: flex;align-items: center;flex: 1;overflow: hidden;">
                                <p style="margin: 3px 5px;white-space: nowrap;text-overflow: ellipsis;overflow: hidden;">{show.name || getFileName(removeExtension(show.id))}</p>
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

                {#if ($active.type || "show") === "show" && $activeShow && !$activeProject.shows.find((show) => show.id === $activeShow?.id)}
                    <Button on:click={() => send("API:add_to_project", { projectId: $activeProject.id, id: $activeShow.id })} style="width: 100%;" dark center>
                        <Icon id="add" right />
                        <p style="font-size: 0.8em;">{translate("context.addToProject", $dictionary)}</p>
                    </Button>
                {/if}
            </div>
        {:else}
            <Center faded>{translate("empty.general", $dictionary)}</Center>

            {#if ($active.type || "show") === "show" && $activeShow}
                <Button on:click={() => send("API:add_to_project", { projectId: $activeProject.id, id: $activeShow.id })} style="width: 100%;" dark center>
                    <Icon id="add" right />
                    <p style="font-size: 0.8em;">{translate("context.addToProject", $dictionary)}</p>
                </Button>
            {/if}
        {/if}

        <Button on:click={() => (editProject = true)} center dark>
            <Icon id="edit" right />
            <p style="font-size: 0.8em;">{translate("titlebar.edit", $dictionary)}</p>
        </Button>
    {/if}
{:else}
    <Projects on:open={() => _set("projectsOpened", false)} />
{/if}

<style>
    .scroll {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }

    .list {
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: auto;
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

    /* project */
    .section {
        text-align: center;
        font-size: 0.75em;
        background-color: var(--primary-darker);
        padding: 2px;
    }
</style>
