<script lang="ts">
    import { Show } from "../../../../types/Show"
    import { activePage, activePopup, popupData, shows, showsCache } from "../../../stores"
    import { getSlideText } from "../../edit/scripts/textStyle"
    import { history } from "../../helpers/history"
    import { loadShows } from "../../helpers/setShow"
    import T from "../../helpers/T.svelte"
    import HRule from "../../input/HRule.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialTextarea from "../../inputs/MaterialTextarea.svelte"
    import Center from "../../system/Center.svelte"
    import Date from "../../system/Date.svelte"
    import Loader from "../Loader.svelte"

    let data = $popupData.data

    let loading = false
    async function deleteMatching() {
        loading = true
        let deleteIds: string[] = []

        await Promise.all(
            data.map(async ({ ids }) => {
                await loadShows(ids)
                let compareShowText = getShowText($showsCache[ids[0]])
                if (!compareShowText) return
                let dIds: string[] = []

                ids.forEach((id, i) => {
                    if (i === 0) {
                        dIds.push(id)
                        return
                    }

                    let showText = getShowText($showsCache[id])
                    if (compareShowText === showText) dIds.push(id)
                })

                dIds.shift()
                if (dIds.length) deleteIds.push(...dIds)
            })
        )

        deleteShows(deleteIds)
        // loading = false
        activePopup.set(null)
        activePage.set("show")
    }

    function deleteOldest() {
        let deleteIds: string[] = []

        data.forEach(({ ids }) => {
            let keepId = ""

            ids.forEach((id) => {
                let show = $shows[id]
                if (!show) return

                let compareShow = $shows[keepId]
                if (!compareShow) {
                    keepId = id
                    return
                }

                if (show.timestamps?.modified > compareShow.timestamps?.modified) keepId = id
            })

            ids = ids.filter((id) => id !== keepId)
            deleteIds.push(...ids)
        })

        deleteShows(deleteIds)
        activePopup.set(null)
        activePage.set("show")
    }

    function deleteNewest() {
        let deleteIds: string[] = []

        data.forEach(({ ids }) => {
            let keepId = ""

            ids.forEach((id) => {
                let show = $shows[id]
                if (!show) return

                let compareShow = $shows[keepId]
                if (!compareShow) {
                    keepId = id
                    return
                }

                if (show.timestamps?.created < compareShow.timestamps?.created) keepId = id
            })

            ids = ids.filter((id) => id !== keepId)
            deleteIds.push(...ids)
        })

        deleteShows(deleteIds)
        activePopup.set(null)
        activePage.set("show")
    }

    // MANUAL

    let manualDeletion = false
    let manualIndex = -1
    function deleteManual() {
        next()
        manualDeletion = true
    }

    // let loading: boolean = false
    async function loadContent() {
        // loading = true
        let ids = getIds(manualIndex)
        await loadShows(ids)

        // loading = false
        ids.forEach((id) => {
            let show = $showsCache[id]
            let text = getShowText(show)
            loadedTexts.push(text)
        })

        loadedTexts = loadedTexts
    }

    let loadedTexts: string[] = []
    function next() {
        if (!data[manualIndex + 1]) {
            activePopup.set(null)
            activePage.set("show")
            return
        }

        manualIndex++
        loadedTexts = []
        loadContent()
    }

    function deleteAtIndex(index: number) {
        let ids = getIds(manualIndex)
        deleteShows([ids[index]])
        data[manualIndex].ids.splice(index, 1)
        loadedTexts.splice(index, 1)

        if (data[manualIndex].ids.length < 2) next()
        else data = data
    }

    /////

    function getIds(index: number, _updater = null): string[] {
        return data[index]?.ids || []
    }

    function deleteShows(ids: string[]) {
        let data = ids.map((id) => ({ id }))
        history({ id: "SHOWS", oldData: { data }, location: { page: "drawer" } })
    }

    function getShowText(show: Show) {
        if (!show) return ""

        let texts: string[] = []
        Object.values(show.slides || {}).forEach((slide) => {
            texts.push(getSlideText(slide))
        })

        return texts.join("\n\n")
    }
</script>

{#if manualDeletion}
    <MaterialButton class="popup-back" icon="back" iconSize={1.3} title="actions.back" on:click={() => (manualDeletion = false)} />

    <div class="shows">
        {#each getIds(manualIndex, data) as showId, i}
            {@const show = $shows[showId] || {}}
            <div class="show">
                <p style="display: flex;align-items: center;justify-content: space-between;padding: 5px 0;">
                    <span>{show.name || "—"}</span>
                    <!-- creation/modified date! -->
                    <span style="opacity: 0.5;font-size: 0.7em;"><Date d={show.timestamps?.modified} /></span>
                </p>

                {#if loadedTexts[i]}
                    <MaterialTextarea label="edit.text" rows={5} value={loadedTexts[i]} disabled />
                {/if}

                <MaterialButton icon="delete" class="red" style="padding: 5px;" on:click={() => deleteAtIndex(i)} white>
                    <T id="actions.delete" />
                </MaterialButton>
            </div>

            <HRule />
        {/each}
    </div>

    <MaterialButton variant="outlined" icon="forward" on:click={next}>
        <T id="guide.skip" />
    </MaterialButton>

    <!-- {#if !loadedTexts.length}
        {#if loading}
            <Loader></Loader>
        {:else}
            <CombinedInput>
                <Button style="width: 100%;" on:click={loadContent} center>Load content</Button>
            </CombinedInput>
        {/if}
    {/if} -->
{:else if loading}
    <Center style="overflow: hidden;">
        <Loader />
    </Center>
{:else}
    <MaterialButton variant="outlined" on:click={deleteManual}>
        <T id="show.delete_manual" />
    </MaterialButton>

    <HRule />

    <MaterialButton variant="outlined" class="red" on:click={deleteMatching}>
        <T id="show.delete_match" />
    </MaterialButton>

    <MaterialButton variant="outlined" class="red" on:click={deleteOldest}>
        <T id="show.delete_keep_last_modified" />
    </MaterialButton>
    <MaterialButton variant="outlined" class="red" on:click={deleteNewest}>
        <T id="show.delete_keep_first_created" />
    </MaterialButton>
{/if}

<style>
    .shows {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .show {
        display: flex;
        flex-direction: column;
    }

    /* red */
    :global(button.red) {
        background-color: rgb(255 0 0 / 0.25) !important;
    }
    :global(button.red):hover:not(.contained):not(.active) {
        background-color: rgb(255 0 0 / 0.35) !important;
    }
    :global(button.red):active:not(.contained):not(.active),
    :global(button.red):focus:not(.contained):not(.active) {
        background-color: rgb(255 0 0 / 0.3) !important;
    }
</style>
