<script lang="ts">
    import type { Show } from "../../../../types/Show"
    import { activePage, activePopup, popupData, shows, showsCache } from "../../../stores"
    import { getSlideText } from "../../edit/scripts/textStyle"
    import { history } from "../../helpers/history"
    import { loadShows } from "../../helpers/setShow"
    import T from "../../helpers/T.svelte"
    import { dateToString } from "../../helpers/time"
    import HRule from "../../input/HRule.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialTextarea from "../../inputs/MaterialTextarea.svelte"
    import Center from "../../system/Center.svelte"
    import Loader from "../Loader.svelte"

    let data = $popupData.data

    let loading = false
    async function deleteMatching() {
        loading = true
        const deleteIds: string[] = []

        await Promise.all(
            data.map(async ({ ids }) => {
                await loadShows(ids)
                const compareShowText = getShowText($showsCache[ids[0]])
                if (!compareShowText) return
                const dIds: string[] = []

                ids.forEach((id, i) => {
                    if (i === 0) {
                        dIds.push(id)
                        return
                    }

                    const showText = getShowText($showsCache[id])
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

    const oldest = getOldestShows()
    function deleteOldest() {
        deleteShows(oldest)
        activePopup.set(null)
        activePage.set("show")
    }
    function getOldestShows() {
        const deleteIds: string[] = []

        data.forEach(({ ids }) => {
            let keepId = ""

            ids.forEach((id) => {
                const show = $shows[id]
                if (!show) return

                const compareShow = $shows[keepId]
                if (!compareShow) {
                    keepId = id
                    return
                }

                const first = show.timestamps?.modified || 0
                const second = compareShow.timestamps?.modified || 0
                if (first > second) keepId = id
            })

            ids = ids.filter((id) => id !== keepId)
            deleteIds.push(...ids)
        })

        return deleteIds
    }

    const newest = getNewestShows()
    function deleteNewest() {
        deleteShows(newest)
        activePopup.set(null)
        activePage.set("show")
    }
    function getNewestShows() {
        const deleteIds: string[] = []

        data.forEach(({ ids }) => {
            let keepId = ""

            ids.forEach((id) => {
                const show = $shows[id]
                if (!show) return

                const compareShow = $shows[keepId]
                if (!compareShow) {
                    keepId = id
                    return
                }

                if (show.timestamps?.created < compareShow.timestamps?.created) keepId = id
            })

            ids = ids.filter((id) => id !== keepId)
            deleteIds.push(...ids)
        })

        return deleteIds
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
        const ids = getIds(manualIndex)
        await loadShows(ids)

        // loading = false
        ids.forEach((id) => {
            const show = $showsCache[id]
            const text = getShowText(show)
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
        const ids = getIds(manualIndex)
        deleteShows([ids[index]])
        data[manualIndex].ids.splice(index, 1)
        loadedTexts.splice(index, 1)

        if (data[manualIndex].ids.length < 2) next()
        else data = data
    }

    /// //

    function getIds(index: number, _updater = null): string[] {
        return data[index]?.ids || []
    }

    function deleteShows(ids: string[]) {
        const data = ids.map((id) => ({ id }))
        history({ id: "SHOWS", oldData: { data }, location: { page: "drawer" } })
    }

    function getShowText(show: Show) {
        if (!show) return ""

        const texts: string[] = []
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
                <p style="display: flex;align-items: center;justify-content: space-between;padding-bottom: 5px;">
                    <span>{show.name || "—"}</span>
                    <!-- creation/modified date! -->
                    <span style="opacity: 0.5;font-size: 0.7em;">{dateToString(show.timestamps?.modified || "", true)}</span>
                </p>

                {#if loadedTexts[i]}
                    <MaterialTextarea label="edit.text" rows={5} value={loadedTexts[i]} disabled />
                {/if}

                <MaterialButton icon="delete" style="padding: 5px;" on:click={() => deleteAtIndex(i)} white red>
                    <T id="actions.delete" />
                </MaterialButton>
            </div>

            <HRule />
        {/each}
    </div>

    <MaterialButton variant="outlined" icon="forward" info="({manualIndex + 1}/{data.length})" on:click={next}>
        <T id="guide.skip" />
    </MaterialButton>
{:else if loading}
    <Center style="overflow: hidden;">
        <Loader />
    </Center>
{:else}
    <MaterialButton variant="outlined" icon="launch" info="{data.length} ({data.map((d) => d.ids.length).reduce((a, b) => a + b, 0)})" on:click={deleteManual} white>
        <T id="show.delete_manual" />
    </MaterialButton>

    <HRule />

    <div class="list">
        <MaterialButton variant="outlined" icon="delete" on:click={deleteMatching} red white>
            <T id="show.delete_match" />
        </MaterialButton>

        <InputRow arrow>
            <MaterialButton disabled={!oldest.length} variant="outlined" icon="delete" info={"" + oldest.length} style="width: 100%;" on:click={deleteOldest} red white>
                <T id="show.delete_keep_last_modified" />
            </MaterialButton>

            <div slot="menu">
                <ul style="list-style-position: inside;margin-left: 20px;">
                    {#each oldest as id}
                        {#if $shows[id]}
                            <li>{$shows[id].name}</li>
                        {/if}
                    {/each}
                </ul>
            </div>
        </InputRow>

        <InputRow arrow>
            <MaterialButton disabled={!newest.length} variant="outlined" icon="delete" info={"" + newest.length} style="width: 100%;" on:click={deleteNewest} red white>
                <T id="show.delete_keep_first_created" />
            </MaterialButton>

            <div slot="menu">
                <ul style="list-style-position: inside;margin-left: 20px;">
                    {#each newest as id}
                        {#if $shows[id]}
                            <li>{$shows[id].name}</li>
                        {/if}
                    {/each}
                </ul>
            </div>
        </InputRow>
    </div>
{/if}

<style>
    .list {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .shows {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .show {
        display: flex;
        flex-direction: column;
    }
</style>
