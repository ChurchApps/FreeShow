<script lang="ts">
    import { SelectIds } from "../../../types/Main"
    import { audioPlaylists, categories, overlayCategories, overlays, shows, templateCategories, templates } from "../../stores"
    import { getAccess } from "../../utils/profile"
    import T from "../helpers/T.svelte"
    import Center from "../system/Center.svelte"
    import SelectElem from "../system/SelectElem.svelte"
    import NavigationButton from "./NavigationButton.svelte"

    export let buttons
    export let id: string
    export let selectId: string

    const categoryStores = {
        shows: () => $categories,
        overlays: () => $overlayCategories,
        templates: () => $templateCategories
    }

    let length: { [key: string]: number } = {}
    if (id) length = {}
    $: {
        let list: any[] = []
        const profile = getAccess(id === "shows" ? "categories" : "")

        if (id === "shows") list = Object.values($shows).filter((a) => !a?.private && profile[a?.category || ""] !== "none")
        else if (id === "overlays") list = Object.values($overlays)
        else if (id === "templates") list = Object.values($templates)

        let totalLength = 0
        buttons.forEach((button) => {
            length[button.id] = 0

            if (button.id === "all") {
                length[button.id] = list.filter((a) => !categoryStores[id]?.()[a?.category]?.isArchive && profile[a?.category] !== "none").length
                return
            }

            length[button.id] = list.filter(checkMatch).length
            totalLength += length[button.id]

            function checkMatch(a) {
                if (!a) return a
                if (button.id === "unlabeled") return a.category === null
                return a.category === button.id
            }
        })

        length.unlabeled += list.length - totalLength
    }
    $: if (id && $audioPlaylists) {
        Object.keys($audioPlaylists).forEach((id) => {
            length[id] = $audioPlaylists[id].songs.length
        })
    }

    const ignoreSelection = ["all", "unlabeled", "favourites", "effects_library", "effects", "online", "screens", "cameras", "microphones", "audio_streams"]
    const idIgnore = ["calendar", "functions"]
    function getCategoryId(category) {
        return (selectId + (id === "scripture" ? "___" + category.icon : "")) as SelectIds
    }
</script>

{#key buttons}
    {#if buttons.length}
        {#each buttons as category}
            {#if category.id === "SEPERATOR"}
                <hr />
            {:else}
                <SelectElem id={getCategoryId(category)} selectable={!ignoreSelection.includes(category.id) && !idIgnore.includes(id)} borders="center" trigger="column" data={category.id}>
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

<style>
    hr {
        height: 2px;
        border: none;
        background-color: var(--primary-lighter);
    }
</style>
