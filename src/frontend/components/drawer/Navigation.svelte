<script lang="ts">
    import { IMPORT } from "../../../types/Channels"
    import type { Category } from "../../../types/Tabs"
    import { activePopup, audioFolders, categories, dictionary, drawerTabsData, labelsDisabled, mediaFolders, overlayCategories, overlays, scriptures, shows, templateCategories, templates, webFavorites } from "../../stores"
    import { send } from "../../utils/request"
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

    export let id: "shows" | "media" | "overlays" | "audio" | "effects" | "scripture" | "calendar" | "templates" | "timers" | "web"

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
                { id: "SEPERATOR", name: "" },
                { id: "online", name: "media.online", default: true, icon: "web" },
                { id: "screens", name: "live.screens", default: true, icon: "screen" },
                { id: "cameras", name: "live.cameras", default: true, icon: "camera" },
                { id: "SEPERATOR", name: "" },
                ...(sortObject(keysToID($mediaFolders), "name") as Button[]),
            ]
        } else if (id === "overlays") {
            buttons = [
                { id: "all", name: "category.all", default: true, icon: "all" },
                { id: "unlabeled", name: "category.unlabeled", default: true, icon: "noIcon" },
                { id: "SEPERATOR", name: "" },
                // WIP move to "Special" ?
                { id: "variables", name: "tabs.variables", default: true, icon: "variable" },
                { id: "triggers", name: "tabs.triggers", default: true, icon: "trigger" },
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
                { id: "microphones", name: "live.microphones", default: true, icon: "microphone" },
                { id: "SEPERATOR", name: "" },
                ...(sortObject(keysToID($audioFolders), "name") as Button[]),
            ]
        } else if (id === "effects") {
            buttons = [{ id: "effects", name: "tabs.effects", default: true, icon: "effects" }]
        } else if (id === "scripture") {
            buttons = getBibleVersions()
        } else if (id === "calendar") {
            buttons = [
                { id: "event", name: "calendar.event", default: true, icon: "calendar" },
                { id: "show", name: "calendar.show", default: true, icon: "showIcon" },
                // TODO: split event timers to it's own space & create popup ???????
                { id: "timer", name: "tabs.timers", default: true, icon: "timer" },
                // TODO: all active in output, not project!!
            ]
        } else if (id === "web") {
            buttons = [...(sortObject(keysToID($webFavorites), "name") as Button[])]
        } else {
            buttons = [
                { id: "all", name: "category.all", default: true, icon: "all" },
                { id: "SEPERATOR", name: "" },
            ]
        }
    }

    // TODO: scroll down to selected
    $: if (buttons.length && !$drawerTabsData[id]?.activeSubTab) setSubTab(buttons[0].id)

    function setSubTab(tabId: string) {
        drawerTabsData.update((a) => {
            a[id] = { activeSubTab: tabId, enabled: a[id]?.enabled !== false }
            return a
        })
    }

    $: if (id === "scripture" && $scriptures) buttons = getBibleVersions()

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
                if (nextIndex < buttons.length) setSubTab(buttons[nextIndex].id)
            } else if (e.key === "ArrowUp") {
                // Ctrl + Arrow Up = change active drawer sub tab
                let index = buttons.findIndex((a) => a.id === $drawerTabsData[id]?.activeSubTab)
                let nextIndex = index - 1
                while (nextIndex >= 0 && buttons[nextIndex]?.id === "SEPERATOR") {
                    nextIndex--
                }
                if (nextIndex >= 0) setSubTab(buttons[nextIndex].id)
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
                <Icon id="add" right={!$labelsDisabled} />
                {#if !$labelsDisabled}<T id="new.category" />{/if}
            </Button>
        </div>
    {:else if id === "media" || id === "audio"}
        <FolderPicker id={id.toUpperCase()} title={$dictionary.new?.folder}>
            <Icon id="add" right={!$labelsDisabled} />
            {#if !$labelsDisabled}<T id="new.folder" />{/if}
        </FolderPicker>
    {:else if id === "overlays"}
        <div class="tabs">
            <Button on:click={() => history({ id: "UPDATE", location: { page: "drawer", id: "category_overlays" } })} center title={$dictionary.new?.category}>
                <Icon id="add" right={!$labelsDisabled} />
                {#if !$labelsDisabled}<T id="new.category" />{/if}
            </Button>
        </div>
    {:else if id === "templates"}
        <div class="tabs">
            <Button on:click={() => history({ id: "UPDATE", location: { page: "drawer", id: "category_templates" } })} center title={$dictionary.new?.category}>
                <Icon id="add" right={!$labelsDisabled} />
                {#if !$labelsDisabled}<T id="new.category" />{/if}
            </Button>
        </div>
    {:else if id === "scripture"}
        <div class="tabs">
            <Button on:click={() => activePopup.set("import_scripture")} center title={$dictionary.new?.scripture}>
                <Icon id="add" right={!$labelsDisabled} />
                {#if !$labelsDisabled}<T id="new.scripture" />{/if}
            </Button>
        </div>
    {:else if id === "calendar"}
        <div class="tabs">
            <Button on:click={() => send(IMPORT, ["calendar"], { name: "Calendar", extensions: ["ics"] })} center title={$dictionary.actions?.import}>
                <Icon id="add" right={!$labelsDisabled} />
                {#if !$labelsDisabled}<T id="actions.import" />{/if}
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
        padding: 0.1em 0.8em !important;
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
