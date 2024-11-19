<script lang="ts">
    import type { TabsObj } from "../../../../types/Tabs"
    import Button from "../../../common/components/Button.svelte"
    import Center from "../../../common/components/Center.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import Tabs from "../../../common/components/Tabs.svelte"
    import { translate } from "../../util/helpers"
    import { GetLayout, getNextSlide, next, nextSlide, previous } from "../../util/output"
    import { send } from "../../util/socket"
    import { _set, active, activeProject, activeShow, dictionary, outLayout, outShow, outSlide, projects, shows, textCache } from "../../util/stores"
    import Media from "../pages/Media.svelte"
    import Project from "../pages/Project.svelte"
    import Shows from "../pages/Shows.svelte"
    import TextEdit from "../pages/TextEdit.svelte"
    import Clear from "../show/Clear.svelte"
    import Slide from "../show/Slide.svelte"
    import Slides from "../show/Slides.svelte"

    let transition: any = { type: "fade", duration: 500 }

    $: layout = $outShow ? GetLayout($outShow, $outLayout) : null
    $: _set("layout", layout)

    $: totalSlides = layout ? layout.length : 0

    ///////

    let activeTab: string = "project"

    // TABS

    let tabs: TabsObj = {}
    $: tabs = {
        shows: { name: translate("remote.shows", $dictionary), icon: "search" },
        project: { name: translate("remote.project", $dictionary), icon: "project" },
    }

    // SHOW

    let scrollElem: any
    // auto scroll
    $: {
        if (scrollElem && $outSlide !== null && slideView === "lyrics") {
            let offset = scrollElem.children[$outSlide]?.offsetTop - scrollElem.offsetTop - 5
            scrollElem.scrollTo(0, offset)
        }
    }

    const slidesViews: any = { grid: "lyrics", lyrics: "grid" }
    let slideView: string = "grid"

    // click when focused
    function double(e: any) {
        let id = e.detail
        if (id === "shows") {
            ;(document.querySelector("#showSearch") as any)?.focus()
        }
    }

    function changeLayout(layoutId: string) {
        send("API:change_layout", { showId: $activeShow.id, layoutId })
    }

    // TEXT EDIT

    let editOpened: boolean = false
    let textValue = ""
    $: if (editOpened && $textCache[$activeShow?.id]) setText()
    function setText() {
        textValue = $textCache[$activeShow?.id]
    }
    function done() {
        editOpened = false
        if ($textCache[$activeShow?.id] === textValue) return

        send("API:set_plain_text", { id: $activeShow?.id, value: textValue })
    }
</script>

<div class="left">
    <div class="flex">
        {#if activeTab === "project"}
            <Project />
        {:else if activeTab === "shows"}
            <Shows tablet />
        {/if}
    </div>

    <Tabs {tabs} bind:active={activeTab} disabled={{ projects: $projects.length, project: $activeProject, shows: $shows.length }} on:double={double} icons />
</div>

<div class="center">
    {#if ($active.type || "show") === "show"}
        {#if $activeShow}
            <!-- <h2>{activeShow.name}</h2> -->

            {#if editOpened}
                <TextEdit bind:value={textValue} />

                <div class="buttons">
                    <Button on:click={done} style="width: 100%;" center dark>
                        <Icon id="check" right />
                        {translate("actions.done", $dictionary)}
                    </Button>
                </div>
            {:else}
                <div bind:this={scrollElem} class="scroll" style="height: 100%;overflow-y: auto;background-color: var(--primary-darker);scroll-behavior: smooth;display: flex;flex-direction: column;">
                    {#if slideView === "lyrics"}
                        {#each GetLayout($activeShow, $activeShow?.settings?.activeLayout) as layoutSlide, i}
                            {#if !layoutSlide.disabled}
                                <span
                                    style="padding: 5px;{$outShow?.id === $activeShow.id && $outSlide === i ? 'background-color: rgba(0 0 0 / 0.6);' : ''}"
                                    on:click={() => {
                                        send("OUT", { id: $activeShow.id, index: i, layout: $activeShow.settings.activeLayout })
                                        _set("outShow", $activeShow)
                                    }}
                                >
                                    <span class="group" style="opacity: 0.6;font-size: 0.8em;display: flex;justify-content: center;position: relative;">
                                        <span style="left: 0;position: absolute;">{i + 1}</span>
                                        <span>{$activeShow.slides[layoutSlide.id].group === null ? "" : $activeShow.slides[layoutSlide.id].group || "—"}</span>
                                    </span>
                                    {#each $activeShow.slides[layoutSlide.id].items as item}
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
                            on:click={(e) => {
                                // TODO: fix...
                                send("OUT", { id: $activeShow.id, index: e.detail, layout: $activeShow.settings.activeLayout })
                                _set("outShow", $activeShow)
                            }}
                            outSlide={$outSlide}
                            columns={3}
                        />
                    {/if}
                </div>

                <!-- TODO: change layout -->
                <div class="layouts">
                    <div style="display: flex;">
                        {#each Object.keys($activeShow.layouts || {}) as id}
                            {@const layout = $activeShow.layouts[id]}
                            <Button on:click={() => changeLayout(id)} active={$activeShow.settings?.activeLayout === id}>
                                {layout.name}
                            </Button>
                        {/each}
                    </div>

                    <div class="buttons">
                        <Button class="context #slideViews" on:click={() => (slideView = slidesViews[slideView])}>
                            <Icon size={1.3} id={slideView} white />
                        </Button>

                        <Button on:click={() => (editOpened = true)} style="width: 100%;" center dark>
                            <Icon id="edit" right />
                            {translate("titlebar.edit", $dictionary)}
                        </Button>
                    </div>
                </div>
            {/if}
        {:else}
            <Center faded>{translate("empty.show", $dictionary)}</Center>
        {/if}
    {:else if $active.type === "image" || $active.type === "video"}
        <Media />
    {:else}
        <p style="text-transform: capitalize;">{$active.type}</p>
    {/if}
</div>

<div class="right" style="jutsify-content: space-between;">
    {#if outShow && layout}
        <div class="top flex">
            <!-- <h2>{outShow.name}</h2> -->
            <div class="outSlides">
                <Slide outSlide={$outSlide} {transition} preview />
            </div>

            <div class="buttons">
                {#key $outSlide}
                    <Clear outSlide={$outSlide} tablet />
                {/key}
            </div>
            <div class="buttons" style="display: flex;width: 100%;">
                <!-- <Button style="flex: 1;" center><Icon id="previousFull" /></Button> -->
                <Button style="flex: 1;" on:click={previous} disabled={$outSlide <= 0} center><Icon size={1.8} id="previous" /></Button>
                <span style="flex: 3;align-self: center;text-align: center;opacity: 0.8;font-size: 0.8em;">{$outSlide + 1}/{totalSlides}</span>
                <Button style="flex: 1;" on:click={next} disabled={$outSlide + 1 >= totalSlides} center><Icon size={1.8} id="next" /></Button>
                <!-- <Button style="flex: 1;" center><Icon id="nextFull" /></Button> -->
            </div>
        </div>

        <div class="outSlides">
            {#if nextSlide(layout, $outSlide) && getNextSlide($outShow, $outSlide, $outLayout)}
                <Slide outSlide={nextSlide(layout, $outSlide) || 0} {transition} preview />
            {:else}
                <div style="display: flex;align-items: center;justify-content: center;flex: 1;opacity: 0.5;padding: 20px 0;">{translate("remote.end", $dictionary)}</div>
            {/if}
        </div>
    {:else}
        <Center faded>{translate("remote.no_output", $dictionary)}</Center>
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

    /* ///// */

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
