<script lang="ts">
    import { active, activeShow, dictionary, outShow, outSlide, textCache } from "../../../util/stores"
    import { translate } from "../../../util/helpers"
    import { GetLayout } from "../../../util/output"
    import { send } from "../../../util/socket"
    import { _set } from "../../../util/stores"

    import Slides from "../../show/Slides.svelte"
    import ShowContent from "../../pages/ShowContent.svelte"
    import AddGroups from "../../pages/AddGroups.svelte"
    import GroupsEdit from "../../pages/GroupsEdit.svelte"
    import TextEdit from "../../pages/TextEdit.svelte"
    import Button from "../../../../common/components/Button.svelte"
    import Icon from "../../../../common/components/Icon.svelte"
    import { getGroupName } from "../../../../common/util/show"

    // Logic from TabletMode.svelte

    $: outNumber = $outSlide ?? -1

    // Slide View / Grid View toggle
    const slidesViews: any = { grid: "lyrics", lyrics: "grid" }
    let slideView: string = "grid"

    // Groups / Edit logic
    let groupsOpened: boolean = false
    let addGroups: boolean = false
    let editOpened: boolean = false
    let textValue = ""

    $: if (editOpened && $textCache[$activeShow?.id || ""]) setText()
    else reset()
    function reset() {
        textValue = ""
    }
    function setText() {
        textValue = $textCache[$activeShow?.id || ""]
    }
    function cancel() {
        editOpened = false
        reset()
    }

    function save() {
        editOpened = false
        if ($textCache[$activeShow?.id || ""] === textValue) return

        send("API:set_plain_text", { id: $activeShow?.id, value: textValue })
    }

    function done() {
        if (addGroups) {
            addGroups = false
            return
        }

        if (groupsOpened) {
            groupsOpened = false
            addGroups = false
            return
        }
    }

    function getName(group: string, layoutSlideId: string, index: number) {
        const name = $activeShow ? getGroupName({ show: $activeShow, showId: $activeShow?.id || "" }, layoutSlideId, group, index, true) : ""
        return name || "—"
    }

    function playSlide(index: number) {
        if (!$activeShow) return

        const showId = $activeShow.id
        const layoutId = $activeShow.settings.activeLayout

        if ($outShow && showId === $outShow.id && layoutId === $outShow.settings.activeLayout && index === outNumber) {
            // reveal lines if it exists
            const ref = GetLayout($activeShow, $activeShow?.settings?.activeLayout)
            const revealExists = $activeShow.slides[ref[index]?.id]?.items?.find(item => item.lineReveal || item.clickReveal)
            if (revealExists) {
                send("API:next_slide")
            }
            return
        }

        send("API:index_select_slide", { showId, layoutId, index })
        _set("outShow", $activeShow)
    }

    function changeLayout(layoutId: string) {
        send("API:change_layout", { showId: $activeShow?.id, layoutId })
    }

    let scrollElem: HTMLElement | undefined
    let scrollRaf: number | null = null
    let userScrolled = false
    let scrollTimeout: number | null = null
    let lastSlideNumber = -1
    let lastAutoScrollTime = 0

    // Detect manual scrolling - disable auto-scroll temporarily
    function handleScroll() {
        if (!scrollElem || slideView !== "lyrics") return

        // If scroll happens more than 300ms after auto-scroll, it's user scroll
        if (Date.now() - lastAutoScrollTime > 300) {
            userScrolled = true
            if (scrollTimeout !== null) clearTimeout(scrollTimeout)
            // Re-enable auto-scroll after 4 seconds
            scrollTimeout = setTimeout(() => {
                userScrolled = false
                scrollTimeout = null
            }, 4000) as unknown as number
        }
    }

    // Auto-scroll to current slide
    $: {
        if (scrollElem && outNumber !== null && slideView === "lyrics" && scrollRaf === null && outNumber !== lastSlideNumber) {
            // Reset flag when slide changes
            if (lastSlideNumber !== -1) {
                userScrolled = false
                if (scrollTimeout !== null) {
                    clearTimeout(scrollTimeout)
                    scrollTimeout = null
                }
            }

            // Auto-scroll if user hasn't manually scrolled
            if (!userScrolled) {
                const elem = scrollElem
                const targetSlide = outNumber
                lastSlideNumber = targetSlide

                scrollRaf = requestAnimationFrame(() => {
                    if (!elem || userScrolled) {
                        scrollRaf = null
                        return
                    }
                    const offset = (elem.children[targetSlide] as HTMLElement)?.offsetTop - elem.offsetTop - 5
                    elem.scrollTo({ top: offset - 50, behavior: "smooth" })
                    lastAutoScrollTime = Date.now()
                    scrollRaf = null
                }) as unknown as number
            } else {
                lastSlideNumber = outNumber
            }
        }
    }
    $: layoutSlides = $activeShow ? GetLayout($activeShow, $activeShow?.settings?.activeLayout) : []
</script>

<div class="center-panel">
    {#if ($active.type || "show") === "show"}
        {#if $activeShow}
            <div style="flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden;">
                {#if groupsOpened || editOpened}
                    {#if groupsOpened}
                        {#if addGroups}
                            <AddGroups show={$activeShow} on:added={() => (addGroups = false)} />
                        {:else}
                            <GroupsEdit show={$activeShow} />
                        {/if}
                    {:else}
                        <TextEdit bind:value={textValue} />
                    {/if}
                {:else}
                    <div bind:this={scrollElem} on:scroll={handleScroll} class="scroll" style="flex: 1;min-height: 0;overflow-y: auto;background-color: var(--primary-darkest);scroll-behavior: smooth;display: flex;flex-direction: column;">
                        {#if slideView === "lyrics"}
                            {#each layoutSlides as layoutSlide, i (layoutSlide.id)}
                                {#if !layoutSlide.disabled}
                                    <span style="padding: 5px;{$outShow?.id === $activeShow.id && outNumber === i ? 'background-color: rgba(0 0 0 / 0.6);' : ''}" role="button" tabindex="0" on:click={() => playSlide(i)} on:keydown={e => (e.key === "Enter" ? playSlide(i) : null)}>
                                        <span class="group" style="opacity: 0.6;font-size: 0.8em;display: flex;justify-content: center;position: relative;">
                                            <span style="left: 0;position: absolute;">{i + 1}</span>
                                            <span>{$activeShow.slides[layoutSlide.id].group === null ? "" : getName($activeShow.slides[layoutSlide.id].group || "", layoutSlide.id, i)}</span>
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
                            <Slides {dictionary} {scrollElem} on:click={e => playSlide(e.detail)} outSlide={outNumber} columns={3} />
                        {/if}
                    </div>
                {/if}
            </div>

            <div class="layouts">
                <div style="display: flex;">
                    {#if !groupsOpened && !editOpened}
                        {#each Object.keys($activeShow.layouts || {}) as id}
                            {@const layout = $activeShow.layouts[id]}
                            <Button on:click={() => changeLayout(id)} active={$activeShow.settings?.activeLayout === id}>
                                {layout.name}
                            </Button>
                        {/each}
                    {/if}
                </div>

                <div class="buttons">
                    {#if groupsOpened}
                        {#if !addGroups}
                            <Button on:click={() => (addGroups = true)} variant="outlined" center>
                                <Icon id="add" />
                                {translate("settings.add", $dictionary)}
                            </Button>
                        {/if}

                        <Button on:click={done} dark center class="done-button">
                            <Icon id={addGroups ? "back" : "check"} />
                            {translate(`actions.${addGroups ? "back" : "done"}`, $dictionary)}
                        </Button>
                    {:else if editOpened}
                        <Button on:click={cancel} variant="outlined" center>
                            <Icon id="close" />
                            {translate("actions.cancel", $dictionary)}
                        </Button>
                        <Button on:click={save} dark center>
                            <Icon id="save" />
                            {translate("actions.save", $dictionary)}
                        </Button>
                    {:else}
                        <Button class="context #slideViews" on:click={() => (slideView = slidesViews[slideView])} variant="outlined">
                            <Icon size={1.3} id={slideView} white />
                        </Button>

                        <Button on:click={() => (groupsOpened = true)} variant="outlined" center class="toolButton">
                            <Icon id="groups" />
                            {translate("tools.groups", $dictionary)}
                        </Button>

                        <Button on:click={() => (editOpened = true)} variant="outlined" center class="toolButton">
                            <Icon id="edit" />
                            {translate("titlebar.edit", $dictionary)}
                        </Button>
                    {/if}
                </div>
            </div>
        {:else}
            <div style="flex: 1; display: flex; justify-content: center; align-items: center; opacity: 0.5; padding-bottom: 20%;">
                {translate("empty.show", $dictionary)}
            </div>
        {/if}
    {:else}
        <ShowContent tablet />
    {/if}
</div>

<style>
    .center-panel {
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        flex: 1;
        min-width: 0;
        overflow: hidden;
        background-color: var(--primary-darkest);
    }

    /* lyric spacing inside scroll */
    .scroll .lyric {
        line-height: 1.5;
        margin: 0.4rem 0; /* gap between lyric blocks */
    }
    .scroll .lyric .break {
        margin-bottom: 0.25rem; /* gap between lines inside a block */
    }

    .layouts {
        display: flex;
        justify-content: space-between;
        background-color: var(--primary-darkest);
        border-radius: 0;
        padding: 4px;
        margin: 0;
        gap: 4px;
        min-height: 60px;
        font-size: 0.95em;
        margin-top: auto;
    }

    .layouts .buttons {
        display: flex;
        gap: 4px;
    }

    .layouts :global(button) {
        border-radius: 8px;
        padding: 0.6em 1em !important;
        min-height: auto !important;
    }
</style>
