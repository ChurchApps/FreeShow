<script lang="ts">
    import type { TabsObj } from "../../../../types/Tabs"
    import { GetLayout, getNextSlide, nextSlide } from "../../helpers/get"
    import { dateToString } from "../../helpers/time"
    import Button from "../Button.svelte"
    import Center from "../Center.svelte"
    import Icon from "../Icon.svelte"
    import ProjectButton from "../ProjectButton.svelte"
    import ShowButton from "../ShowButton.svelte"
    import Clear from "../slide/Clear.svelte"
    import Slide from "../slide/Slide.svelte"
    import Slides from "../slide/Slides.svelte"
    import Tabs from "../Tabs.svelte"

    export let dictionary
    export let projects
    export let activeProject: any
    export let activeShow: any
    export let shows: any[]
    export let send: Function

    export let outSlide: any
    export let outShow: any
    export let styleRes: any

    export let outLayout: any
    export let layout: any
    export let transition: any
    export let totalSlides: any
    export let previous: any // Function
    export let next: any // Function

    let activeTab: string = "project"

    // SEARCH

    let searchValue: string = ""
    // sort shows in alphabeticly order
    let showsSorted: any
    $: {
        showsSorted = shows.filter((s) => s.private !== true).sort((a: any, b: any) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
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
        filteredShows = filteredShows.sort((a: any, b: any) => (a.match < b.match ? -1 : a.match > b.match ? 1 : 0))
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

    // shows list
    function openShow(id: string) {
        send("SHOW", id)
        // activeTab = "show"
    }

    function showSearchKeydown(e: any) {
        if (e.key === "Enter") openShow(filteredShows[0].id)
    }

    // TABS

    let tabs: TabsObj = {}
    $: tabs = {
        projects: { name: dictionary.remote.projects, icon: "folder" },
        project: { name: dictionary.remote.project, icon: "project" },
        shows: { name: dictionary.remote.shows, icon: "shows" },
    }

    // SHOW

    let scrollElem: any
    // auto scroll
    $: {
        if (scrollElem && outSlide !== null && slideView === "lyrics") {
            let offset = scrollElem.children[outSlide]?.offsetTop - scrollElem.offsetTop - 5
            scrollElem.scrollTo(0, offset)
        }
    }

    const slidesViews: any = { grid: "lyrics", lyrics: "grid" }
    let slideView: string = "grid"
</script>

<div class="left">
    <div class="header" style={activeTab === "shows" ? "padding: 0;" : ""}>
        {#if activeTab === "projects"}
            {dictionary.remote?.projects}
        {:else if activeTab === "project"}
            {activeProject?.name}
        {:else if activeTab === "shows"}
            <input type="text" class="input" placeholder="Search..." bind:value={searchValue} on:keydown={showSearchKeydown} />
        {/if}
    </div>

    <div class="flex">
        {#if activeTab === "projects"}
            {#if projects.length}
                <!-- <Projects {folders} {projects} activeProject={project} bind:activeShow {openedFolders} /> -->
                {#each projects as project}
                    <ProjectButton
                        active={activeProject?.id === project.id}
                        name={project.name}
                        on:click={() => {
                            activeProject = project
                            activeTab = "project"
                        }}
                    />
                {/each}
            {:else}
                <Center faded>{dictionary.empty.project_select}</Center>
            {/if}
        {:else if activeTab === "project"}
            {#if activeProject}
                {#if activeProject.shows.length}
                    <div class="scroll">
                        {#each activeProject.shows as show}
                            {#if show.type === "section"}
                                <div class="section">{show.name}</div>
                            {:else if show.type && show.type !== "show"}
                                <div class="media" style="opacity: 0.5;padding: 5px 22px;text-transform: capitalize;font-size: 0.8em;">{show.type || show.name || show.id}</div>
                            {:else if shows.find((s) => s.id === show.id)}
                                <ShowButton
                                    on:click={(e) => openShow(e.detail)}
                                    {activeShow}
                                    show={shows.find((s) => s.id === show.id)}
                                    icon={shows.find((s) => s.id === show.id).private ? "private" : shows.find((s) => s.id === show.id).type ? shows.find((s) => s.id === show.id).type : "noIcon"}
                                />
                            {/if}
                        {/each}
                    </div>
                {:else}
                    <Center faded>{dictionary.empty.shows}</Center>
                {/if}
            {:else}
                <Center faded>{dictionary.empty.project_select}</Center>
            {/if}
        {:else if activeTab === "shows"}
            {#if shows.length}
                <div class="scroll">
                    {#each filteredShows as show}
                        {#if searchValue.length <= 1 || show.match}
                            <ShowButton on:click={(e) => openShow(e.detail)} {activeShow} show={shows.find((s) => s.id === show.id)} data={dateToString(show.timestamps.created, true)} match={show.match || null} />
                        {/if}
                    {/each}
                </div>
                {#if searchValue.length > 1 && totalMatch === 0}
                    <Center faded>{dictionary.empty.search}</Center>
                {/if}
            {:else}
                <Center faded>{dictionary.empty.shows}</Center>
            {/if}
        {/if}
    </div>

    <Tabs {tabs} bind:active={activeTab} disabled={{ projects: projects.length, project: activeProject, shows: shows.length }} icons />
</div>

<div class="center">
    {#if activeShow}
        <!-- <h2>{activeShow.name}</h2> -->

        <div bind:this={scrollElem} class="scroll" style="height: 100%;overflow-y: auto;background-color: var(--primary-darker);scroll-behavior: smooth;display: flex;flex-direction: column;">
            {#if slideView === "lyrics"}
                {#each GetLayout(activeShow, activeShow?.settings?.activeLayout) as layoutSlide, i}
                    {#if !layoutSlide.disabled}
                        <span
                            style="padding: 5px;{outShow?.id === activeShow.id && outSlide === i ? 'background-color: rgba(0 0 0 / 0.6);' : ''}"
                            on:click={() => {
                                send("OUT", { id: activeShow.id, index: i, layout: activeShow.settings.activeLayout })
                                outShow = activeShow
                            }}
                        >
                            <span class="group" style="opacity: 0.6;font-size: 0.8em;display: flex;justify-content: center;position: relative;">
                                <span style="left: 0;position: absolute;">{i + 1}</span>
                                <span>{activeShow.slides[layoutSlide.id].group === null ? "" : activeShow.slides[layoutSlide.id].group || "—"}</span>
                            </span>
                            {#each activeShow.slides[layoutSlide.id].items as item}
                                {#if item.lines}
                                    <div class="lyric" style="font-size: 1.1em;text-align: center;">
                                        {#each item.lines as line}
                                            <div class="break">
                                                {#each line.text || [] as text}
                                                    <span>{@html text.value}</span>
                                                {/each}
                                            </div>
                                        {/each}
                                    </div>
                                {:else}
                                    <span style="opacity: 0.5;">—</span>
                                {/if}
                            {/each}
                        </span>
                    {/if}
                {/each}
            {:else}
                <Slides
                    {dictionary}
                    {scrollElem}
                    {outShow}
                    {activeShow}
                    on:click={(e) => {
                        // TODO: fix...
                        send("OUT", { id: activeShow.id, index: e.detail, layout: activeShow.settings.activeLayout })
                        outShow = activeShow
                    }}
                    {outSlide}
                    {styleRes}
                    columns={3}
                />
            {/if}
        </div>

        <!-- TODO: change layout -->
        <div class="layouts">
            <div></div>

            <div class="buttons">
                <Button class="context #slideViews" on:click={() => (slideView = slidesViews[slideView])}>
                    <Icon size={1.3} id={slideView} white />
                </Button>
            </div>
        </div>
    {:else}
        <Center faded>{dictionary.empty.show}</Center>
    {/if}
</div>

<div class="right" style="jutsify-content: space-between;">
    {#if outShow && layout}
        <div class="top flex">
            <!-- <h2>{outShow.name}</h2> -->
            <div class="outSlides">
                <Slide {outShow} {outSlide} {outLayout} {styleRes} {transition} preview />
            </div>

            <div class="buttons">
                <Clear
                    {dictionary}
                    {outSlide}
                    on:click={(e) => {
                        send(e.detail.id, e.detail.value)
                        // activeTab = "show"
                    }}
                />
            </div>
            <div class="buttons" style="display: flex;width: 100%;">
                <!-- <Button style="flex: 1;" center><Icon id="previousFull" /></Button> -->
                <Button style="flex: 1;" on:click={previous} disabled={outSlide <= 0} center><Icon size={1.8} id="previous" /></Button>
                <span style="flex: 3;align-self: center;text-align: center;opacity: 0.8;font-size: 0.8em;">{outSlide + 1}/{totalSlides}</span>
                <Button style="flex: 1;" on:click={next} disabled={outSlide + 1 >= totalSlides} center><Icon size={1.8} id="next" /></Button>
                <!-- <Button style="flex: 1;" center><Icon id="nextFull" /></Button> -->
            </div>
        </div>

        <div class="outSlides">
            {#if nextSlide(layout, outSlide) && getNextSlide(outShow, outSlide, outLayout)}
                <Slide {outShow} outSlide={nextSlide(layout, outSlide)} {outLayout} {styleRes} {transition} preview />
            {:else}
                <div style="display: flex;align-items: center;justify-content: center;flex: 1;opacity: 0.5;padding: 20px 0;">{dictionary.remote.end}</div>
            {/if}
        </div>
    {:else}
        <Center faded>{dictionary.remote.no_output}</Center>
    {/if}
</div>

<style>
    .left,
    .center,
    .right {
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    .left,
    .right {
        width: 290px;
    }

    .left {
        border-right: 4px solid var(--primary-lighter);
    }
    .right {
        border-left: 4px solid var(--primary-lighter);
    }

    .center {
        flex: 1;
    }

    /* // SEARCH // */

    .input {
        background-color: rgb(0 0 0 / 0.2);
        color: var(--text);
        /* font-family: inherit; */
        padding: 10px 18px;
        border: none;
        font-size: inherit;
    }
    .input:active,
    .input:focus {
        outline: 2px solid var(--secondary);
        /* background-color: var(--secondary-opacity); */
    }
    .input::placeholder {
        color: inherit;
        opacity: 0.4;
    }

    /* ///// */

    .header {
        display: flex;
        justify-content: center;
        align-items: center;

        background-color: var(--primary-darker);
        width: 100%;

        padding: 0.2em 0.8em;
        font-weight: 600;
        font-size: 0.9em;
    }

    .flex {
        display: flex;
        flex-direction: column;
        flex: 1;

        overflow-y: auto;
    }

    /* ///// */

    .layouts {
        display: flex;
        justify-content: space-between;

        background-color: var(--primary-darkest);

        font-size: 0.9em;
    }

    .layouts .buttons {
        display: flex;
    }

    /* ///// */

    .outSlides {
        display: flex;
        width: 100%;
    }
</style>
