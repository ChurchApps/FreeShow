<script lang="ts">
    import VirtualList from "@sveltejs/svelte-virtual-list"
    import type { ShowList } from "../../../types/Show"
    import { activePopup, activeProject, activeShow, dictionary, sortedShowsList, textCache } from "../../stores"
    import { clone, sortObjectNumbers } from "../helpers/array"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { dateToString } from "../helpers/time"
    import Button from "../inputs/Button.svelte"
    import ShowButton from "../inputs/ShowButton.svelte"
    import Autoscroll from "../system/Autoscroll.svelte"
    import Center from "../system/Center.svelte"
    import SelectElem from "../system/SelectElem.svelte"

    export let id: string
    export let active: string | null
    export let searchValue: string

    // TODO: better search
    $: sva = searchValue
        .toLowerCase()
        // .replace(/[^\w\s,]/g, "")
        .replace(/[.\/#!?$%\^&\*;:{}=\-_`~()]/g, "")
        .split(" ")
    // $: sva = searchValue
    //   .toLowerCase()
    //   .replace(/[.\/#!?$%\^&\*;:{}=\-_`~() ]/g, "")
    //   .split(",")

    // .replace(/[^\w\s]/g, "")
    const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~() ]/g, "")
    const searchIncludes = (s: string, sv: string): boolean => filter(s).includes(sv)
    const searchEquals = (s: string, sv: string): boolean => filter(s) === sv

    let totalMatch: number = 0
    $: totalMatch = searchValue ? 0 : 0
    function search(obj: any): number {
        let match: any[] = []

        sva.forEach((sv, i) => {
            if (sv.length > 1) {
                match[i] = 0
                // if (searchEquals(obj.name, sv)) match[i] = 100
                // else
                if (searchIncludes(obj.name, sv)) match[i] += 25
                // if (obj.category !== null && searchIncludes($categories[obj.category].name, sv)) match[i] += 10

                let cache = $textCache[obj.id]
                if (cache) {
                    cache.split(".").forEach((text: string) => {
                        if (searchEquals(text, sv)) match[i] += 20
                        else if (searchIncludes(text, sv)) {
                            match[i] += 10
                        }
                    })
                }

                // if ($showsCache[obj.id]) {
                //   let lines: any[] = _show(obj.id).slides().items().lines().get()[0]
                //   lines?.forEach((line) => {
                //     let text = line.text?.map((t: any) => t.value)[0]
                //     if (text?.length) {
                //       if (searchEquals(text, sv)) match[i] += 20
                //       else if (searchIncludes(text, sv)) {
                //         // TODO: more specific match
                //         // console.log(sv, filter(text))
                //         // match[i] += (10 * (sv.length / filter(text).length)).toFixed()
                //         match[i] += 10
                //       }
                //     }
                //   })
                // }
            }
        })

        let sum = 0
        let hasZero = match.some((m) => {
            sum += m
            return m === 0
        })

        if (hasZero) sum = 0

        // find exact
        if (sum >= 100) sum = 99
        if (sva.join(" ") === obj.name.toLowerCase()) sum = 100

        totalMatch += sum
        return Math.min(sum, 100)
    }

    $: showsSorted = $sortedShowsList

    let filteredShows: ShowList[]
    let filteredStored: any
    $: filteredStored = filteredShows = active === "all" ? showsSorted : showsSorted.filter((s: any) => active === s.category || (active === "unlabeled" && s.category === null))

    export let firstMatch: null | any = null
    let previousSearchValue: string[] = []
    $: {
        if (searchValue.length > 1) {
            let currentShowsList = filteredStored
            // reset if search value changed
            if (sva.length === previousSearchValue.length && newSearchIncludesPrevious()) {
                currentShowsList = filteredShows
            }
            filteredShows = []

            console.log(currentShowsList)

            currentShowsList.forEach((s: any) => {
                let match = search(s)
                if (match) filteredShows.push({ ...s, match })
            })
            filteredShows = sortObjectNumbers(filteredShows, "match", true) as ShowList[]
            firstMatch = filteredShows[0] || null

            previousSearchValue = clone(sva)
        } else {
            filteredShows = filteredStored
            firstMatch = null
        }
    }

    function newSearchIncludesPrevious() {
        let matching = true
        previousSearchValue.forEach((value, i) => {
            if (!sva[i].includes(value)) matching = false
        })
        return matching
    }

    let scrollElem: any
    let offset: number = -1
    $: {
        if (id && $activeShow !== null) {
            if (id === "shows" && $activeShow.type === null && scrollElem) offset = scrollElem.querySelector("#" + $activeShow.id)?.offsetTop - scrollElem.offsetTop
        }
    }

    function keydown(e: any) {
        if (!e.target.closest("input") && !e.target.closest(".edit") && (e.ctrlKey || e.metaKey) && filteredShows.length) {
            let id: any = null
            if (e.key === "ArrowRight") {
                if (!$activeShow || ($activeShow.type !== undefined && $activeShow.type !== "show")) id = filteredShows[0].id
                else {
                    let currentIndex: number = filteredShows.findIndex((a) => a.id === $activeShow!.id)
                    if (currentIndex < filteredShows.length - 1) id = filteredShows[currentIndex + 1].id
                }
            } else if (e.key === "ArrowLeft") {
                if (!$activeShow || ($activeShow.type !== undefined && $activeShow.type !== "show")) id = filteredShows[filteredShows.length - 1].id
                else {
                    let currentIndex: number = filteredShows.findIndex((a) => a.id === $activeShow!.id)
                    if (currentIndex > 0) id = filteredShows[currentIndex - 1].id
                }
            }
            // TODO: index...
            if (id) activeShow.set({ id, type: "show" })
        }
    }
</script>

<svelte:window on:keydown={keydown} />

<Autoscroll {offset} bind:scrollElem style="overflow-y: auto;flex: 1;">
    <div class="column context #drawer_show">
        {#if filteredShows.length}
            <VirtualList items={filteredShows} let:item={show}>
                <SelectElem id="show_drawer" data={{ id: show.id }} draggable>
                    {#if searchValue.length <= 1 || show.match}
                        <ShowButton id={show.id} {show} data={dateToString(show.timestamps.created, true, $dictionary)} class="#drawer_show_button__drawer_show" match={show.match || null} />
                    {/if}
                </SelectElem>
            </VirtualList>

            <!-- TODO: not updating values on activeSubTab change -->
            {#if searchValue.length > 1 && totalMatch === 0}
                <Center size={1.2} faded><T id="empty.search" /></Center>
            {/if}
        {:else}
            <Center size={1.2} faded><T id="empty.shows" /></Center>
        {/if}
    </div>
</Autoscroll>
<div class="tabs">
    <Button
        style="flex: 1;"
        on:click={(e) => {
            if (e.ctrlKey || e.metaKey) {
                history({ id: "UPDATE", newData: { remember: { project: $activeProject } }, location: { page: "show", id: "show" } })
            } else activePopup.set("show")
        }}
        class="context #drawer_new_show"
        center
        title={$dictionary.tooltip?.show}
    >
        <Icon id="showIcon" right />
        <span style="color: var(--secondary);">
            <T id="new.show" />
        </span>
    </Button>
</div>

<style>
    .column {
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        background-color: var(--primary-darker);
        height: 100%;
    }

    .tabs {
        display: flex;
        background-color: var(--primary-darkest);
    }

    /* .column.hidden :global(button) {
    display: none;
  } */
</style>
