<script lang="ts">
    import Button from "../../../common/components/Button.svelte"
    import Center from "../../../common/components/Center.svelte"
    import Dropdown from "../../../common/components/Dropdown.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import { translate } from "../../util/helpers"
    import { GetLayout, next, previous } from "../../util/output"
    import { send } from "../../util/socket"
    import { _set, activeShow, activeTab, dictionary, outLayout, outShow, outSlide, textCache } from "../../util/stores"
    import Clear from "../show/Clear.svelte"
    import Slides from "../show/Slides.svelte"
    import TextEdit from "./TextEdit.svelte"

    $: layout = $outShow ? GetLayout($outShow, $outLayout) : null
    $: _set("layout", layout)

    $: totalSlides = layout ? layout.length : 0

    let scrollElem: any
    let lyricsScroll: any
    // auto scroll
    $: {
        if (lyricsScroll && outSlide !== null && $activeTab === "lyrics") {
            let offset = lyricsScroll.children[$outSlide]?.offsetTop - lyricsScroll.offsetTop - 5
            lyricsScroll.scrollTo(0, offset)
        }
    }

    $: layouts = Object.entries($activeShow?.layouts || {}).map(([id, a]: any) => ({ id, name: a.name }))

    function changeLayout(e: any) {
        let layoutId = e.detail?.id
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

{#if $activeShow && GetLayout($activeShow, $activeShow?.settings?.activeLayout).length}
    <h2 class="header">{$activeShow.name || ""}</h2>

    {#if editOpened && !($activeShow.id === $outShow?.id)}
        <TextEdit bind:value={textValue} />

        <div class="buttons">
            <Button on:click={done} style="width: 100%;" center dark>
                <Icon id="check" right />
                {translate("actions.done", $dictionary)}
            </Button>
        </div>
    {:else}
        <div bind:this={scrollElem} class="scroll" style="background-color: var(--primary-darker);scroll-behavior: smooth;">
            <Slides
                {dictionary}
                {scrollElem}
                on:click={(e) => {
                    // TODO: fix...
                    send("OUT", { id: $activeShow.id, index: e.detail, layout: $activeShow.settings.activeLayout })
                    _set("outShow", $activeShow)
                    send("API:get_cleared")
                }}
                outSlide={$outSlide}
            />
        </div>

        {#if $activeShow.id === $outShow?.id}
            <div class="buttons">
                {#key $outSlide}
                    <Clear outSlide={$outSlide} />
                {/key}
            </div>
            <div class="buttons" style="display: flex;width: 100%;">
                <!-- <Button style="flex: 1;" center><Icon id="previousFull" /></Button> -->
                <Button style="flex: 1;" on:click={previous} disabled={$outSlide <= 0} center><Icon size={1.8} id="previous" /></Button>
                <span style="flex: 3;align-self: center;text-align: center;opacity: 0.8;font-size: 0.8em;">{$outSlide + 1}/{totalSlides}</span>
                <Button style="flex: 1;" on:click={next} disabled={$outSlide + 1 >= totalSlides} center><Icon size={1.8} id="next" /></Button>
                <!-- <Button style="flex: 1;" center><Icon id="nextFull" /></Button> -->
            </div>
        {:else}
            <div class="buttons">
                {#if layouts.length > 1}
                    <Dropdown value={layouts.find((a) => a.id == $activeShow.settings?.activeLayout)?.name || "—"} options={layouts} on:click={changeLayout} style="width: 100%;" up />
                {/if}

                <Button on:click={() => (editOpened = true)} style="width: 100%;" center dark>
                    <Icon id="edit" right />
                    {translate("titlebar.edit", $dictionary)}
                </Button>
            </div>
        {/if}
    {/if}
{:else}
    <Center faded>{translate("empty.show", $dictionary)}</Center>
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
