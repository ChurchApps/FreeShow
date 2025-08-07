<script lang="ts">
    import Button from "../../../common/components/Button.svelte"
    import Center from "../../../common/components/Center.svelte"
    import Dropdown from "../../../common/components/Dropdown.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import { translate } from "../../util/helpers"
    import { GetLayout } from "../../util/output"
    import { send } from "../../util/socket"
    import { _set, activeShow, activeTab, dictionary, isCleared, outLayout, outShow, outSlide, textCache } from "../../util/stores"
    import Clear from "../show/Clear.svelte"
    import Slides from "../show/Slides.svelte"
    import AddGroups from "./AddGroups.svelte"
    import GroupsEdit from "./GroupsEdit.svelte"
    import TextEdit from "./TextEdit.svelte"

    $: layout = $outShow ? GetLayout($outShow, $outLayout) : null
    $: _set("layout", layout)

    $: slideNum = $outSlide ?? -1

    $: totalSlides = layout ? layout.length : 0

    let scrollElem: HTMLElement | undefined
    let lyricsScroll: any
    // auto scroll
    $: {
        if (lyricsScroll && slideNum !== null && $activeTab === "lyrics") {
            let offset = lyricsScroll.children[slideNum]?.offsetTop - lyricsScroll.offsetTop - 5
            lyricsScroll.scrollTo(0, offset)
        }
    }

    $: layouts = Object.entries($activeShow?.layouts || {}).map(([id, a]: any) => ({ id, name: a.name }))

    function changeLayout(e: any) {
        let layoutId = e.detail?.id
        send("API:change_layout", { showId: $activeShow?.id, layoutId })
    }

    // GROUPS EDIT

    let groupsOpened: boolean = false
    let addGroups: boolean = false

    // TEXT EDIT

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

        editOpened = false
        if ($textCache[$activeShow?.id || ""] === textValue) return

        send("API:set_plain_text", { id: $activeShow?.id, value: textValue })
    }

    function playSlide(index: number) {
        if (!$activeShow) return

        const showId = $activeShow.id
        const layoutId = $activeShow.settings.activeLayout

        if ($outShow && showId === $outShow.id && layoutId === $outShow.settings.activeLayout && index === slideNum) {
            // reveal lines if it exists
            const ref = GetLayout($activeShow, $activeShow?.settings?.activeLayout)
            const revealExists = $activeShow.slides[ref[index]?.id]?.items?.find((item) => item.lineReveal || item.clickReveal)
            if (revealExists) {
                send("API:next_slide") // , { onlyCurrentReveal: true }
            }
            return
        }

        send("API:index_select_slide", { showId, layoutId, index })
        _set("outShow", $activeShow)
        send("API:get_cleared")
    }
</script>

<!-- GetLayout($activeShow, $activeShow?.settings?.activeLayout).length -->
{#if $activeShow?.layouts}
    <h2 class="header">{$activeShow.name || ""}</h2>

    {#if (groupsOpened || editOpened) && !($activeShow.id === $outShow?.id)}
        {#if groupsOpened}
            {#if addGroups}
                <AddGroups show={$activeShow} on:added={() => (addGroups = false)} />
            {:else}
                <GroupsEdit show={$activeShow} />
            {/if}
        {:else}
            <TextEdit bind:value={textValue} />
        {/if}

        <div class="buttons">
            {#if groupsOpened && !addGroups}
                <Button on:click={() => (addGroups = true)} style="width: 100%;" center dark>
                    <Icon id="add" right />
                    {translate("settings.add", $dictionary)}
                </Button>
            {/if}

            <Button on:click={done} style="width: 100%;" center dark>
                <Icon id={addGroups ? "back" : "check"} right />
                {translate(`actions.${addGroups ? "back" : "done"}`, $dictionary)}
            </Button>
        </div>
    {:else}
        <div bind:this={scrollElem} class="scroll" style="background-color: var(--primary-darker);scroll-behavior: smooth;">
            <Slides {dictionary} {scrollElem} on:click={(e) => playSlide(e.detail)} outSlide={slideNum} />
        </div>

        {#if $activeShow.id === $outShow?.id || !$isCleared.all}
            <div class="buttons">
                {#key slideNum}
                    <Clear outSlide={slideNum} />
                {/key}
            </div>

            {#if $activeShow.id === $outShow?.id}
                <div class="buttons" style="display: flex;width: 100%;">
                    <!-- <Button style="flex: 1;" center><Icon id="previousFull" /></Button> -->
                    <Button style="flex: 1;" on:click={() => send("API:previous_slide")} disabled={slideNum <= 0} center><Icon size={1.8} id="previous" /></Button>
                    <span style="flex: 3;align-self: center;text-align: center;opacity: 0.8;font-size: 0.8em;">{slideNum + 1}/{totalSlides}</span>
                    <Button style="flex: 1;" on:click={() => send("API:next_slide")} disabled={slideNum + 1 >= totalSlides} center><Icon size={1.8} id="next" /></Button>
                    <!-- <Button style="flex: 1;" center><Icon id="nextFull" /></Button> -->
                </div>
            {/if}
        {:else}
            <div class="buttons">
                {#if layouts.length > 1}
                    <Dropdown value={layouts.find((a) => a.id == $activeShow.settings?.activeLayout)?.name || "—"} options={layouts} on:click={changeLayout} style="width: 100%;" up />
                {/if}

                <div class="edit" style="display: flex;">
                    <Button on:click={() => (groupsOpened = true)} style="width: 100%;" center dark>
                        <Icon id="groups" right />
                        {translate("tools.groups", $dictionary)}
                    </Button>
                    <Button on:click={() => (editOpened = true)} style="width: 100%;" center dark>
                        <Icon id="edit" right />
                        {translate("titlebar.edit", $dictionary)}
                    </Button>
                </div>
            </div>
        {/if}
    {/if}
{:else}
    <Center faded>{translate("empty.slides", $dictionary)}</Center>
{/if}

<style>
    .scroll {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }
</style>
