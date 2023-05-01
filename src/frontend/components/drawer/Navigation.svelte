<script lang="ts">
    import type { Category } from "../../../types/Tabs"
    import { activePopup, audioFolders, categories, dictionary, drawerTabsData, mediaFolders, overlayCategories, overlays, scriptures, shows, templateCategories, templates, webFavorites } from "../../stores"
    import { keysToID, sortObject } from "../helpers/array"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import FolderPicker from "../inputs/FolderPicker.svelte"
    import Center from "../system/Center.svelte"
    import DropArea from "../system/DropArea.svelte"
    import SelectElem from "../system/SelectElem.svelte"
    import NavigationButton from "./NavigationButton.svelte"

    export let id: "shows" | "media" | "overlays" | "audio" | "scripture" | "templates" | "player" | "live" | "timers" | "web"

    interface Button extends Category {
        id: string
        url?: string
    }
    let buttons: Button[] = []
    $: {
        if (id === "shows" && $dictionary) {
            buttons = [
                { id: "all", name: "category.all", default: true, icon: "all" },
                { id: "unlabeled", name: "category.unlabeled", default: true, icon: "noIcon" },
                { id: "SEPERATOR", name: "" },
                ...(sortObject(keysToID($categories), "name") as Button[]),
            ]
        } else if (id === "media") {
            buttons = [
                { id: "all", name: "category.all", default: true, icon: "all" },
                { id: "favourites", name: "category.favourites", default: true, icon: "star" },
                { id: "pixabay", name: "Pixabay", icon: "web" },
                { id: "SEPERATOR", name: "" },
                ...(sortObject(keysToID($mediaFolders), "name") as Button[]),
            ]
        } else if (id === "overlays") {
            buttons = [
                { id: "all", name: "category.all", default: true, icon: "all" },
                { id: "unlabeled", name: "category.unlabeled", default: true, icon: "noIcon" },
                { id: "SEPERATOR", name: "" },
                ...(sortObject(keysToID($overlayCategories), "name") as Button[]),
            ]
        } else if (id === "templates") {
            buttons = [
                { id: "all", name: "category.all", default: true, icon: "all" },
                { id: "unlabeled", name: "category.unlabeled", default: true, icon: "noIcon" },
                { id: "SEPERATOR", name: "" },
                ...(sortObject(keysToID($templateCategories), "name") as Button[]),
            ]
        } else if (id === "audio") {
            buttons = [
                { id: "all", name: "category.all", default: true, icon: "all" },
                { id: "favourites", name: "category.favourites", default: true, icon: "star" },
                { id: "SEPERATOR", name: "" },
                ...(sortObject(keysToID($audioFolders), "name") as Button[]),
            ]
        } else if (id === "scripture") {
            buttons = getBibleVersions()
        } else if (id === "player") {
            buttons = [
                { id: "youtube", name: "YouTube", icon: "youtube" },
                { id: "vimeo", name: "Vimeo", icon: "vimeo" },
            ]
        } else if (id === "timers") {
            buttons = [
                // { id: "all", name: "all", default: true, icon: "all" }, ???????
                // TODO: split event timers to it's own space & create popup ???????
                { id: "timer", name: "stage.global_timers", default: true, icon: "timer" },
                // { id: "events", name: "event timers...", default: true, icon: "event" },
                // TODO: all active in output, not project!!
                { id: "project", name: "remote.project", default: true, icon: "project" },
            ]
        } else if (id === "web") {
            buttons = [...(sortObject(keysToID($webFavorites), "name") as Button[])]
        } else if (id === "live") {
            buttons = [
                { id: "screens", name: "live.screens", default: true, icon: "screen" },
                { id: "windows", name: "live.windows", default: true, icon: "window" },
                { id: "cameras", name: "live.cameras", default: true, icon: "camera" },
                { id: "microphones", name: "live.microphones", default: true, icon: "microphone" },
            ]
        } else
            buttons = [
                { id: "all", name: "category.all", default: true, icon: "all" },
                { id: "SEPERATOR", name: "" },
            ]
    }

    // TODO: scroll down to selected
    $: {
        if (buttons.length && $drawerTabsData[id]?.activeSubTab === null) {
            setTab(buttons[0].id)
        }
    }

    function setTab(tabID: string) {
        drawerTabsData.update((dt) => {
            dt[id] = { activeSubTab: tabID, enabled: dt[id]?.enabled !== false }
            return dt
        })
    }

    $: if (id === "scripture") {
        scriptures.subscribe(() => {
            buttons = getBibleVersions()
        })
    }

    const getBibleVersions = () =>
        keysToID($scriptures)
            .map((a: any) => ({ ...a, icon: a.api ? "scripture_alt" : a.collection ? "collection" : "scripture" }))
            .sort((a: any, b: any) => b.name.localeCompare(a.name))
            .sort((a: any, b: any) => (a.api === true && b.api !== true ? 1 : -1))
            .sort((a: any, b: any) => (a.collection !== undefined && b.collection === undefined ? -1 : 1))

    let length: any = {}
    if (id) length = {}
    $: {
        let list: any[] = []
        if (id === "shows") list = Object.values($shows).filter((a: any) => !a.private)
        else if (id === "overlays") list = Object.values($overlays)
        else if (id === "templates") list = Object.values($templates)

        let totalLength: number = 0
        buttons.forEach((button) => {
            length[button.id] = 0

            if (button.id === "all") {
                length[button.id] = list.length
                return
            }

            length[button.id] = list.filter(checkMatch).length
            totalLength += length[button.id]

            function checkMatch(a) {
                if (button.id === "unlabeled") return a.category === null
                return a.category === button.id
            }
        })

        length.unlabeled += list.length - totalLength
    }

    function keydown(e: KeyboardEvent) {
        if (!e.target?.closest(".edit") && (e.ctrlKey || e.metaKey)) {
            if (e.key === "ArrowDown") {
                // Ctrl + Arrow Down = change active drawer sub tab
                let index = buttons.findIndex((a) => a.id === $drawerTabsData[id]?.activeSubTab)
                let nextIndex = index + 1
                while (nextIndex < buttons.length && buttons[nextIndex]?.id === "SEPERATOR") {
                    nextIndex++
                }
                if (nextIndex < buttons.length) setTab(buttons[nextIndex].id)
            } else if (e.key === "ArrowUp") {
                // Ctrl + Arrow Up = change active drawer sub tab
                let index = buttons.findIndex((a) => a.id === $drawerTabsData[id]?.activeSubTab)
                let nextIndex = index - 1
                while (nextIndex >= 0 && buttons[nextIndex]?.id === "SEPERATOR") {
                    nextIndex--
                }
                if (nextIndex >= 0) setTab(buttons[nextIndex].id)
            }
        }
    }

    let selectId: any = "category"
    $: selectId = "category_" + id
</script>

<svelte:window on:keydown={keydown} />

<div class="main">
    <div class="categories context #category_{id}">
        <DropArea id="navigation" selectChildren>
            {#key buttons}
                {#if buttons.length}
                    {#each buttons as category}
                        {#if category.id === "SEPERATOR"}
                            <hr />
                        {:else}
                            <SelectElem id={selectId} borders="center" trigger="column" data={category.id}>
                                <NavigationButton {id} {category} {length} />
                            </SelectElem>
                        {/if}
                    {/each}
                {:else}
                    <Center faded>
                        <T id="empty.general" />
                    </Center>
                {/if}
            {/key}
            <!-- {#if id === "scripture"}
        <a class="source" href="#void" on:click={() => window.api.send(MAIN, { channel: "URL", data: "https://scripture.api.bible/" })}> API.Bible </a>
      {/if} -->
        </DropArea>
    </div>
    {#if id === "shows"}
        <div class="tabs">
            <Button on:click={() => history({ id: "UPDATE", location: { page: "drawer", id: "category_shows" } })} center title={$dictionary.new?.category}>
                <Icon id="all" right />
                <span style="color: var(--secondary);">
                    <T id="new.category" />
                </span>
            </Button>
        </div>
    {:else if id === "media" || id === "audio"}
        <FolderPicker id={id.toUpperCase()} title={$dictionary.new?.folder}>
            <Icon id="folder" right />
            <span style="color: var(--secondary);">
                <T id="new.folder" />
            </span>
        </FolderPicker>
    {:else if id === "overlays"}
        <div class="tabs">
            <Button on:click={() => history({ id: "UPDATE", location: { page: "drawer", id: "category_overlays" } })} center title={$dictionary.new?.category}>
                <Icon id="all" right />
                <span style="color: var(--secondary);">
                    <T id="new.category" />
                </span>
            </Button>
        </div>
    {:else if id === "templates"}
        <div class="tabs">
            <Button on:click={() => history({ id: "UPDATE", location: { page: "drawer", id: "category_templates" } })} center title={$dictionary.new?.category}>
                <Icon id="all" right />
                <span style="color: var(--secondary);">
                    <T id="new.category" />
                </span>
            </Button>
        </div>
    {:else if id === "scripture"}
        <div class="tabs">
            <Button on:click={() => activePopup.set("import_scripture")} center title={$dictionary.new?.scripture}>
                <Icon id="scripture" right />
                <span style="color: var(--secondary);">
                    <T id="new.scripture" />
                </span>
            </Button>
        </div>
    {/if}
</div>

<style>
    .main,
    .categories {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }

    .categories :global(button) {
        width: 100%;
        padding: 0.2em 0.8em;
        justify-content: space-between;
    }
    .tabs :global(button) {
        width: 100%;
    }

    .tabs {
        display: flex;
        background-color: var(--primary-darker);
    }

    hr {
        height: 2px;
        border: none;
        background-color: var(--primary-lighter);
    }

    .source {
        display: flex;
        justify-content: center;
        color: var(--text);
        opacity: 0.5;
        padding: 10px;
        font-weight: bold;
    }
    .source:hover {
        opacity: 0.8;
    }
</style>
