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

type ProjectSection = {
    id: string
    name: string | null
    items: any[]
}

const MEDIA_TYPES = new Set(["image", "video", "overlay", "audio", "pdf"])
const THUMBNAIL_TYPES = new Set(["image", "video"])

let editProject = false
let showLookup: Record<string, ShowList> = {}

$: showLookup = Array.isArray($shows)
    ? Object.fromEntries(($shows as unknown as ShowList[]).map((show) => [show.id, show]))
    : {}

$: projectSections = buildProjectSections($activeProject?.shows || [])
$: canAddActiveShow =
    ($active.type || "show") === "show" &&
    $activeShow &&
    !!$activeProject?.shows &&
    !$activeProject.shows.some((show) => getShowId(show) === $activeShow?.id)

function getShowId(show: any): string | undefined {
    return show?.id
}

function getShowType(show: any): string {
    return (show?.type || "").toString()
}

function isMediaType(type: string): boolean {
    return MEDIA_TYPES.has(type)
}

function needsThumbnail(type: string): boolean {
    return THUMBNAIL_TYPES.has(type)
}

function buildProjectSections(shows: any[] = []): ProjectSection[] {
    if (!Array.isArray(shows) || !shows.length) return []

    const sections: ProjectSection[] = []
    let current: ProjectSection | null = null

    const startSection = (id: string, name: string | null) => {
        const section = { id, name, items: [] as any[] }
        sections.push(section)
        return section
    }

    current = startSection("section-root", null)

    shows.forEach((show, index) => {
        if (getShowType(show).toLowerCase() === "section") {
            current = startSection(`section-${index}`, show?.name?.trim() || null)
            return
        }

        current?.items.push(show)
    })

    return sections.filter((section) => section.items.length)
}

    function renameProject() {
        const name = prompt("Enter a new name:", $activeProject?.name)
        if (!name) return

        send("API:rename_project", { id: $activeProject?.id, name })
        activeProject.update((current) => (current ? { ...current, name } : current))
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
    <div class="project-wrapper">
        {#if editProject}
            <div class="list">
                <div class="header">
                    <Button on:click={() => (editProject = false)} class="header-back">
                        <Icon id="back" size={1.5} />
                    </Button>
                    <p style="flex: 1;text-align: center;padding: 0.2em 0.8em;">{$activeProject.name}</p>

                    <div class="header-actions">
                        <Button
                            on:click={renameProject}
                            center
                            dark
                            class="header-action-button"
                            aria-label={translate("actions.rename", $dictionary)}
                            title={translate("actions.rename", $dictionary)}
                        >
                            <Icon id="rename" size={1.2} />
                        </Button>

                        <Button
                            on:click={deleteProject}
                            center
                            dark
                            class="header-action-button destructive"
                            aria-label={translate("actions.delete", $dictionary)}
                            title={translate("actions.delete", $dictionary)}
                        >
                            <Icon id="delete" size={1.2} />
                        </Button>
                    </div>
                </div>

                <div class="list edit-list">
                    {#each $activeProject.shows as show, i}
                        {@const showId = getShowId(show)}
                        {@const lookupShow = showId ? showLookup[showId] ?? null : null}
                        <div class="item">
                            <p style="padding: 4px 8px;">{lookupShow?.name || show.name || (showId ? getFileName(removeExtension(showId)) : show.type)}</p>

                            <Button style="padding: 4px 8px;" on:click={() => removeProjectItem(i)} dark>
                                <Icon id="delete" />
                            </Button>
                        </div>
                    {/each}
                </div>
            </div>
        {:else}
            <div class="header">
                <Button on:click={() => _set("projectsOpened", true)} class="header-back">
                    <Icon id="back" size={1.5} />
                </Button>
                <p class="header-title">{$activeProject.name}</p>
            </div>

            {#if projectSections.length}
                <div class="scroll project-shows-list">
                    <div class="project-sections">
                        {#each projectSections as section}
                            <div class="section-card">
                                {#if section.name}
                                    <div class="section-title">
                                        {section.name}
                                    </div>
                                {/if}
                                <div class="section-items">
                                    {#each section.items as show}
                                        {@const showId = getShowId(show)}
                                        {@const showType = getShowType(show)}
                                        {@const showData = showId ? showLookup[showId] ?? null : null}

                                        {#if isMediaType(showType)}
                                            <Button
                                                on:click={() => {
                                                    _set("active", show)
                                                    _set("activeTab", "show")
                                                    if (showId && needsThumbnail(showType) && !$mediaCache[showId]) send("API:get_thumbnail", { path: showId })
                                                }}
                                                active={$active.id === showId}
                                                bold={false}
                                                border
                                                class="section-item-button"
                                            >
                                                <Icon id={showType === "audio" ? "music" : showType === "overlay" ? "overlays" : showType} right />
                                                <span style="display: flex;align-items: center;flex: 1;overflow: hidden;min-width: 0;">
                                                    <p style="margin: 0;white-space: nowrap;text-overflow: ellipsis;overflow: hidden;">{show.name || (showId ? getFileName(removeExtension(showId)) : "")}</p>
                                                </span>
                                            </Button>
                                        {:else if showType && showType !== "show"}
                                            <div class="section-item info">
                                                <Icon id={showType} box={showType === "ppt" ? 50 : 24} right />
                                                <p>{showType}</p>
                                            </div>
                                        {:else if showData}
                                            <div
                                                class="show-button-wrapper"
                                                class:active={($active.type || "show") === "show" && $activeShow?.id === showData.id}
                                            >
                                                <ShowButton
                                                    class="project-show-button"
                                                    on:click={(e) => {
                                                        _set("active", show)
                                                        _set("activeTab", "show")
                                                        send("SHOW", e.detail)
                                                    }}
                                                    activeShow={($active.type || "show") === "show" && $activeShow}
                                                    show={showData}
                                                    icon={showData.private ? "private" : "slide"}
                                                />
                                            </div>
                                        {/if}
                                    {/each}
                                </div>
                            </div>
                        {/each}
                    </div>

                    {#if canAddActiveShow}
                        <Button
                            on:click={() => {
                                project.set($activeProject.id || "")
                                send("API:add_to_project", { projectId: $activeProject.id, id: $activeShow?.id })
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

                {#if canAddActiveShow}
                    <Button
                        on:click={() => {
                            project.set($activeProject.id || "")
                            send("API:add_to_project", { projectId: $activeProject.id, id: $activeShow?.id })
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
        {/if}

        <div class="floating-input-container">
            <Button
                on:click={() => (editProject = !editProject)}
                center
                dark
                class="floating-edit-input"
                aria-label={editProject ? translate("actions.done", $dictionary) : translate("titlebar.edit", $dictionary)}
                title={editProject ? translate("actions.done", $dictionary) : translate("titlebar.edit", $dictionary)}
            >
                <Icon id={editProject ? "check" : "edit"} size={1.2} />
                <span>{editProject ? translate("actions.done", $dictionary) : translate("titlebar.edit", $dictionary)}</span>
            </Button>
        </div>
    </div>
{:else}
    <Projects on:open={() => _set("projectsOpened", false)} />
{/if}

<style>
    .project-wrapper {
        position: relative;
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
    }

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

    /* Project shows list - grouped sections */
    .project-shows-list {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
        touch-action: pan-y;
        overscroll-behavior: contain;
        padding: 0 0 70px;
        /* FreeShow UI scrollbar */
        scrollbar-width: thin; /* Firefox */
        scrollbar-color: rgb(255 255 255 / 0.3) rgb(255 255 255 / 0.05);
    }

    .project-shows-list::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }

    .project-shows-list::-webkit-scrollbar-track,
        .project-shows-list::-webkit-scrollbar-corner {
        background: rgb(255 255 255 / 0.05);
    }

    .project-shows-list::-webkit-scrollbar-thumb {
        background: rgb(255 255 255 / 0.3);
        border-radius: 8px;
    }

    .project-shows-list::-webkit-scrollbar-thumb:hover {
        background: rgb(255 255 255 / 0.5);
    }

    .project-sections {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
        margin: 0.75rem 0;
        align-items: stretch;
        width: 100%;
        padding-right: 12px;
    }

    .section-card {
        background-color: var(--primary-darkest);
        border: 1px solid var(--primary-lighter);
        border-left: none;
        border-radius: 0 12px 12px 0;
        overflow: hidden;
        box-shadow: 0 4px 12px rgb(0 0 0 / 0.25);
        width: 100%;
        /* max-width: 520px; */
    }

    .section-title {
        font-size: 0.78em;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding: 0.45rem 0.95rem;
        background-color: var(--primary-darker);
        border-bottom: 1px solid var(--primary-lighter);
        color: rgb(255 255 255 / 0.75);
    }

    .section-items {
        display: flex;
        flex-direction: column;
    }

    :global(.section-item-button),
    :global(.project-show-button) {
        min-height: 48px !important;
        height: 48px !important;
        padding: 0.35rem 0.85rem !important;
        font-size: 1em;
        box-sizing: border-box;
        display: flex !important;
        align-items: center !important;
        gap: 0.6em;
        border-radius: 0 !important;
        background-color: transparent !important;
        border: none !important;
        box-shadow: none !important;
        text-align: left;
    }

    :global(.section-item-button:hover) {
        background-color: rgb(255 255 255 / 0.05) !important;
    }

    :global(.section-item-button.active) {
        background-color: rgb(255 255 255 / 0.08) !important;
        border-left: 3px solid var(--secondary) !important;
        padding-left: calc(0.65rem - 3px) !important;
    }

    :global(.section-item-button) :global(svg) {
        width: 1.4em;
        height: 1.4em;
        margin-right: 0.6em;
    }

    :global(.section-item-button) :global(p),
    :global(.section-item-button) :global(span) {
        display: flex;
        align-items: center;
        margin: 0;
        line-height: 1.2;
    }

    .section-item.info {
        display: flex;
        align-items: center;
        gap: 0.6em;
        padding: 0.35rem 0.85rem;
        min-height: 48px;
        font-size: 1em;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        opacity: 0.75;
    }

    .show-button-wrapper {
        padding: 0;
        margin: 0;
        background-color: transparent;
        border-radius: 0;
        transition: background-color 0.15s ease;
        min-height: 48px;
    }

    .section-items > .show-button-wrapper:first-child,
    .section-items > :global(.section-item-button:first-child) {
        border-top-right-radius: 12px;
    }

    .section-items > .show-button-wrapper:last-child,
    .section-items > :global(.section-item-button:last-child) {
        border-bottom-right-radius: 12px;
    }

    .show-button-wrapper:hover {
        background-color: rgb(255 255 255 / 0.05);
    }

    .show-button-wrapper.active {
        background-color: rgb(255 255 255 / 0.08);
        border-left: 3px solid var(--secondary);
    }

    .show-button-wrapper :global(button) {
        width: 100%;
        border-radius: 0 !important;
        background-color: transparent !important;
        border: none !important;
        box-shadow: none !important;
        font-size: 1em;
        text-align: left;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between;
        gap: 0.6em;
        min-height: inherit;
    }

    .show-button-wrapper.active :global(button) {
        padding-left: calc(0.65rem - 3px) !important;
    }

    /* List items */
    .list .item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--primary-lighter);
        padding: 0.5em 0;
    }

    .list .item p {
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
        flex: 1;
        margin: 0;
    }

    /* Header layout - match global header style */
    .header {
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        height: 58px;
        padding: 0 44px;
        border-bottom: 1px solid var(--primary-lighter);
        background-color: var(--primary-darker);
        color: var(--text);
        font-weight: 600;
        font-size: 1.05em;
        box-sizing: border-box;
    }

    .header :global(.header-back) {
        position: absolute;
        left: 0;
        padding: 0.5em;
        min-width: 44px;
        min-height: 44px;
    }

    .header-title {
        flex: 1;
        text-align: center;
        padding: 0;
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .header-actions {
        position: absolute;
        right: 0;
        display: flex;
        align-items: center;
        gap: 0.35em;
        padding: 0 0.5em;
    }

    :global(.header-action-button) {
        padding: 0.4em;
        min-height: 38px;
        min-width: 38px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    :global(.header-action-button svg) {
        width: 1.25em;
        height: 1.25em;
    }

    :global(.header-action-button.destructive) {
        background-color: var(--danger, #a00);
    }

    .floating-input-container {
        position: absolute;
        bottom: 10px;
        right: 15px;
        z-index: 10;
    }

    :global(.floating-edit-input) {
        font-size: 1em;
        border-radius: 50px !important;
        height: 40px;
        padding: 0 20px !important;
        display: flex !important;
        align-items: center !important;
        gap: 0.45em;
        background-color: rgba(25, 25, 35, 0.92) !important;
        border: 2px solid rgba(255, 255, 255, 0.1) !important;
        box-shadow: 1px 1px 6px rgb(0 0 0 / 0.4);
        backdrop-filter: blur(3px);
    }

    :global(.floating-edit-input span) {
        font-weight: 600;
        white-space: nowrap;
    }

    :global(.floating-edit-input:hover) {
        background-color: rgba(35, 35, 55, 0.95) !important;
        transform: translateY(-1px);
    }

    /* Mobile styles */
    @media screen and (max-width: 1000px) {
        .header {
            height: 60px;
            font-size: 1.15em;
        }

        .project-shows-list {
            gap: 3px;
        }

        .section-items > * {
            height: 60px;
            min-height: 60px;
            box-sizing: border-box;
        }

        :global(.section-item-button),
        :global(.project-show-button) {
            min-height: 60px !important;
            height: 60px !important;
            padding: 0.9rem 1.1rem !important;
            font-size: 1.1em;
        }

        :global(.section-item-button) :global(svg),
        :global(.project-show-button) :global(svg) {
            width: 1.75em;
            height: 1.75em;
        }

        .section-item.info,
        .show-button-wrapper {
            min-height: 60px;
            font-size: 1.1em;
        }

        .show-button-wrapper :global(button) {
            padding: 0.9rem 1.1rem !important;
        }

        .floating-input-container {
            bottom: 15px;
            right: 10px;
        }
    }
</style>
