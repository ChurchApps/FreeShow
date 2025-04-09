<script lang="ts">
    import { Show } from "../../../../types/Show"
    import { activePage, activePopup, dictionary, popupData, shows, showsCache } from "../../../stores"
    import { getSlideText } from "../../edit/scripts/textStyle"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import { loadShows } from "../../helpers/setShow"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import TextArea from "../../inputs/TextArea.svelte"
    import Center from "../../system/Center.svelte"
    import Date from "../../system/Date.svelte"
    import Loader from "../Loader.svelte"

    let data = $popupData.data

    let loading: boolean = false
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

                if (dIds.length > 1) deleteIds.push(...dIds)
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

    let manualDeletion: boolean = false
    let manualIndex: number = -1
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

    function getIds(index: number): string[] {
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
    <Button class="popup-back" title={$dictionary.actions?.back} on:click={() => (manualDeletion = false)}>
        <Icon id="back" size={2} white />
    </Button>

    <div class="shows">
        {#each getIds(manualIndex) as showId, i}
            {@const show = $shows[showId] || {}}
            <div class="show">
                <p style="display: flex;align-items: center;justify-content: space-between;padding: 5px 0;">
                    <span>{show.name || "—"}</span>
                    <!-- creation/modified date! -->
                    <span style="opacity: 0.5;font-size: 0.7em;"><Date d={show.timestamps?.modified} /></span>
                </p>

                {#if loadedTexts[i]}
                    <TextArea value={loadedTexts[i]} style="min-height: 180px;" disabled />
                {/if}

                <Button style="width: 100%;" on:click={() => deleteAtIndex(i)} center red>
                    <Icon id="delete" right />
                    <T id="actions.delete" />
                </Button>
            </div>
        {/each}
    </div>

    <CombinedInput>
        <Button style="width: 100%;" on:click={next} center>
            <Icon id="forward" right />
            <T id="guide.skip" />
        </Button>
    </CombinedInput>
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
    <CombinedInput>
        <Button style="width: 100%;" on:click={deleteManual} center>
            <T id="show.delete_manual" />
        </Button>
    </CombinedInput>

    <br />

    <CombinedInput>
        <Button style="width: 100%;" on:click={deleteMatching} center red>
            <T id="show.delete_match" />
        </Button>
    </CombinedInput>

    <CombinedInput>
        <Button style="width: 100%;" on:click={deleteOldest} center red>
            <T id="show.delete_keep_last_modified" />
        </Button>
    </CombinedInput>
    <CombinedInput>
        <Button style="width: 100%;" on:click={deleteNewest} center red>
            <T id="show.delete_keep_first_created" />
        </Button>
    </CombinedInput>
{/if}

<style>
    .shows {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 20px;
    }

    .show {
        display: flex;
        flex-direction: column;
    }
</style>
