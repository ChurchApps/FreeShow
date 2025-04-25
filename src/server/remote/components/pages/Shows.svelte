<script lang="ts">
    import { onMount } from "svelte"
    import Center from "../../../common/components/Center.svelte"
    import Checkbox from "../../../common/components/Checkbox.svelte"
    import { dateToString } from "../../../common/util/time"
    import { translate } from "../../util/helpers"
    import { send } from "../../util/socket"
    import { _set, activeShow, createShow, dictionary, quickPlay, shows, showSearchValue } from "../../util/stores"
    import ShowButton from "../ShowButton.svelte"
    import Button from "../../../common/components/Button.svelte"
    import Icon from "../../../common/components/Icon.svelte"

    export let tablet: boolean = false

    $: searchValue = $showSearchValue
    // sort shows in alphabeticly order
    let showsSorted: any
    $: {
        showsSorted = $shows.filter((s) => s.private !== true).sort((a: any, b: any) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        // removeValues(sortObject(keysToID(s), "name"), "private", true)
    }
    let filteredShows: any[]
    let filteredStored: any
    $: filteredStored = showsSorted
    // $: filteredStored = showsSorted.filter((s: any) => category === "all" || category === s.category || (category === "unlabeled" && s.category === null))
    // $: console.log(filteredStored)

    export let firstMatch: null | string = null
    $: {
        if (searchValue.length > 1) setTimeout(findMatches, 10)
        else {
            filteredShows = filteredStored
            firstMatch = null
        }
    }

    function findMatches() {
        filteredShows = []
        filteredStored.forEach((s: any) => {
            let match = search(s)
            if (match) filteredShows.push({ ...s, match })
        })
        // filteredShows = sortObjectNumbers(filteredShows, "match", true) as ShowId[]
        filteredShows = filteredShows.sort((a: any, b: any) => (a.match < b.match ? 1 : a.match > b.match ? -1 : 0))
        firstMatch = filteredShows[0]?.id || null
    }

    $: sva = searchValue
        .toLowerCase()
        .replace(/[.\/#!?$%\^&\*;:{}=\-_`~(),]/g, "")
        .split(" ")
    const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~() ]/g, "")
    const searchIncludes = (s: string, sv: string): boolean => filter(s).includes(sv)
    const searchEquals = (s: string, sv: string): boolean => filter(s) === sv

    let totalMatch: number = 0
    $: totalMatch = searchValue ? 0 : 0
    function search(obj: any): number {
        let match: any[] = []

        sva.forEach((sv: any, i: number) => {
            if (sv.length > 1) {
                match[i] = 0

                if (searchEquals(obj.name.toLowerCase(), sv)) match[i] = 100
                else if (searchIncludes(obj.name.toLowerCase(), sv)) match[i] += 25
            }
        })

        let sum = 0
        let hasZero = match.some((m) => {
            sum += m
            return m === 0
        })

        if (hasZero) sum = 0

        totalMatch += sum
        return Math.min(sum, 100)
    }

    // click on content
    // function click(e: any) {
    //     if (e.clientX < window.innerWidth / 3) previous()
    //     else next()
    // }

    // shows list
    let searchElem: HTMLInputElement | undefined
    function openShow(id: string) {
        send("SHOW", id)

        if ($quickPlay) {
            send("API:index_select_slide", { showId: id, index: 0 })
            searchElem?.select()
        } else {
            _set("active", { id, type: "show" })
            _set("activeTab", "show")
        }
    }

    function showSearchKeydown(e: any) {
        if (e.key === "Enter") openShow(filteredShows[0].id)
    }

    // show quick play
    function toggleQuickPlay(e: any) {
        let quickPlay = e.target.checked
        localStorage.setItem("quickPlay", quickPlay.toString())
        _set("quickPlay", quickPlay)
    }

    function newShow() {
        createShow.set(true)
    }

    onMount(() => {
        try {
            _set("quickPlay", localStorage.getItem("quickPlay") === "true")
        } catch (err) {
            console.log("Unable to use LocalStorage!")
        }

        setTimeout(() => (loadingStarted = true), 10)
    })

    // SEARCH

    function updateTextValue(e: any) {
        showSearchValue.set(e.target?.value)
        selected = false
    }

    let selected = false
    function select(e: any) {
        if (selected) return
        e.target?.select()
        selected = true
    }

    // SCROLL

    let scrollElem: HTMLDivElement | undefined
    $: activeShowId = $activeShow?.id
    $: if (activeShowId && scrollElem && scrollElem.scrollTop < 10) {
        let activeElement = [...scrollElem.children].find((a) => a.id === activeShowId) as HTMLDivElement | undefined
        scrollElem.scrollTo(0, (activeElement?.offsetTop || 0) - 50 - 80)
    }

    // open tab instantly before loading content
    let loadingStarted: boolean = false
</script>

{#if $shows.length}
    {#if $shows.length < 10 || loadingStarted}
        <input id="showSearch" type="text" class="input" placeholder="Search..." value={searchValue} on:input={updateTextValue} on:keydown={showSearchKeydown} on:click={select} bind:this={searchElem} />
        <!-- {#each shows as showObj}
<Button on:click={() => (show = showObj.id)}>{showObj.name}</Button>
{/each} -->
        <div class="scroll" bind:this={scrollElem}>
            {#each filteredShows as show}
                {#if searchValue.length <= 1 || show.match}
                    <ShowButton on:click={(e) => openShow(e.detail)} activeShow={$activeShow} show={$shows.find((s) => s.id === show.id)} data={dateToString(show.timestamps?.created, true)} match={show.match || null} />
                {/if}
            {/each}
        </div>
        {#if searchValue.length > 1 && totalMatch === 0}
            <Center faded>{translate("empty.search", $dictionary)}</Center>
        {/if}

        {#if searchValue.length < 2}
            <div class="buttons">
                {#if !tablet}
                    <div class="check">
                        <p style="font-size: 0.8em;">{translate("remote.quick_play", $dictionary)}</p>
                        <Checkbox checked={$quickPlay} on:change={toggleQuickPlay} />
                    </div>
                {/if}

                <Button on:click={newShow} style="width: 100%;" center dark>
                    <Icon id="add" right />
                    <p style="font-size: 0.8em;">{translate("new.show", $dictionary)}</p>
                </Button>
            </div>
        {/if}
    {:else}
        <Center faded>{translate("remote.loading", $dictionary)}</Center>
    {/if}
{:else}
    <Center faded>{translate("empty.shows", $dictionary)}</Center>
{/if}

<style>
    .scroll {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }

    /* quick play */
    .check {
        display: flex;
        background-color: var(--primary-darker);
        justify-content: space-between;
        padding: 10px;
        align-items: center;
    }

    .input {
        background-color: rgb(0 0 0 / 0.2);
        color: var(--text);
        /* font-family: inherit; */
        padding: 10px 18px;
        border: none;
        font-size: inherit;

        border-bottom: 2px solid var(--secondary);
    }
    .input:active,
    .input:focus {
        outline: 2px solid var(--secondary);
        outline-offset: -2px;
        /* background-color: var(--secondary-opacity); */
    }
    .input::placeholder {
        color: inherit;
        opacity: 0.4;
    }
</style>
