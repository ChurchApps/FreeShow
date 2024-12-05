<script lang="ts">
    import { audioFolders, audioPlaylists, categories, dictionary, drawerTabsData, mediaFolders, midiIn, notFound, overlayCategories, scriptures, templateCategories } from "../../stores"
    import { getActionIcon } from "../actions/actions"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import HiddenInput from "../inputs/HiddenInput.svelte"

    export let id: any
    export let category: any
    export let length: any

    function setTab(tabID: string) {
        drawerTabsData.update((dt) => {
            dt[id] = { activeSubTab: tabID, enabled: dt[id]?.enabled !== false }
            return dt
        })
    }

    const nameCategories: any = {
        shows: (c: any) => categories.update((a) => setName(a, c)),
        media: (c: any) => mediaFolders.update((a) => setName(a, c)),
        audio: (c: any) => audioFolders.update((a) => setName(a, c)),
        playlist: (c: any) => audioPlaylists.update((a) => setName(a, c)),
        overlays: (c: any) => overlayCategories.update((a) => setName(a, c)),
        templates: (c: any) => templateCategories.update((a) => setName(a, c)),
        scripture: (c: any) => scriptures.update((a) => setName(a, c, "customName")),
    }
    const setName = (a: any, { name, id }: any, nameKey: string = "name") => {
        // api scriptures
        if (!a[id]) id = Object.entries(a).find(([_, a]: any) => a.id === id)?.[0]
        if (!a[id]) return a

        if (a[id].default) delete a[id].default
        a[id][nameKey] = name

        return a
    }

    function changeName(e: any, categoryId: string) {
        if ($audioPlaylists[categoryId]) id = "playlist"
        if (nameCategories[id]) nameCategories[id]({ name: e.detail.value, id: categoryId })
        else console.log("rename " + id)
    }

    let editActive: boolean = false

    $: red = id === "scripture" && $notFound.bible.find((a: any) => a.id === category.id)

    const defaultFolders = ["all", "unlabeled", "favourites", "online", "screens", "cameras", "microphones", "audio_streams"]
</script>

<Button
    class={defaultFolders.includes(category.id) ? "" : $audioPlaylists[category.id] ? "context #playlist" : `context #category_${id}_button__category_${id}`}
    active={category.id === $drawerTabsData[id]?.activeSubTab}
    {red}
    on:click={(e) => {
        if (!editActive && !e.ctrlKey && !e.metaKey && !e.shiftKey) setTab(category.id)
    }}
    bold={false}
    title={category.description ? category.description : category.path ? category.path : ""}
>
    <span style="display: flex;align-items: center;width: calc(100% - 20px);">
        <Icon
            id={category.icon || "noIcon"}
            custom={["shows", "overlays", "templates"].includes(id) && ![undefined, "noIcon", "all", "variable", "trigger"].includes(category.icon)}
            select={["shows", "overlays", "templates"].includes(id) && !["all", "unlabeled", "favourites", "variables", "triggers"].includes(category.id)}
            selectData={{ id: "category_" + id, data: [category.id] }}
            right
        />
        <span id={category.id} style="width: calc(100% - 15px);text-align: left;">
            {#if category.id === "all" || category.id === "unlabeled" || category.id === "favourites"}
                <p style="margin: 5px;"><T id={category.name} /></p>
            {:else}
                <HiddenInput
                    value={category.default ? $dictionary[category.name.split(".")[0]]?.[category.name.split(".")[1]] : category.customName || category.name}
                    id={"category_" + id + "_" + category.id}
                    on:edit={(e) => changeName(e, category.id)}
                    bind:edit={editActive}
                />
            {/if}
        </span>
    </span>

    {#if category.action}
        <span style="padding: 0 5px;" title={$midiIn[category.action]?.name}>
            <Icon id={getActionIcon(category.action)} size={0.8} white />
        </span>
    {/if}

    {#if length[category.id]}
        <span style="opacity: 0.5;font-size: 0.9em;min-width: 15px;text-align: right;">
            {length[category.id]}
        </span>
    {/if}
</Button>
