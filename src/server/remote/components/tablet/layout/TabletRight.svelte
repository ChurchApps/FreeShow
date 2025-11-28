<script lang="ts">
    import { dictionary, isCleared, outLayout, outShow, outSlide } from "../../../util/stores"
    import { translate } from "../../../util/helpers"
    import { GetLayout, getNextSlide, nextSlide } from "../../../util/output"
    import { send } from "../../../util/socket"
    import { _set } from "../../../util/stores"

    import Slide from "../../show/Slide.svelte"
    import Clear from "../../show/Clear.svelte"
    import Button from "../../../../common/components/Button.svelte"
    import Icon from "../../../../common/components/Icon.svelte"

    $: outNumber = $outSlide ?? -1
    let transition: any = { type: "fade", duration: 500 }

    $: layout = $outShow ? GetLayout($outShow, $outLayout) : null
    $: totalSlides = layout ? layout.length : 0
    $: outShowName = $outShow?.name || translate("remote.no_show_selected", $dictionary) || "—"

    function openOutShow() {
        const showId = $outShow?.id
        if (!showId) return

        send("SHOW", showId)
        _set("active", { id: showId, type: "show" })
        _set("activeTab", "show")
        _set("activeShow", $outShow)
    }

    function handleLabelKeydown(event: KeyboardEvent) {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            openOutShow()
        }
    }
</script>

<div class="right-panel">

        <div class="top flex">
            <div class="outSlides">
                {#if $isCleared.all}
                    <div style="width: 100%; aspect-ratio: 16/9; background-color: black; border-radius: 4px; border: 1px solid #333;"></div>
                {:else if $outShow && layout}
                    <Slide outSlide={outNumber} {transition} preview />
                {/if}
            </div>

            <div class="buttons">
                {#key outNumber}
                    <Clear outSlide={outNumber} tablet />
                {/key}
            </div>

            {#if $outShow && layout}
                <div class="controls">
                    <div class="nav-buttons">
                        <Button on:click={() => send("API:previous_slide")} disabled={outNumber <= 0} variant="outlined" center compact>
                            <Icon id="previous" size={1.5} />
                        </Button>
                        <span class="counter">{outNumber + 1}/{totalSlides}</span>
                        <Button on:click={() => send("API:next_slide")} disabled={outNumber + 1 >= totalSlides} variant="outlined" center compact>
                            <Icon id="next" size={1.5} />
                        </Button>
                    </div>

                    {#if $outShow}
                        <button class="current-show-label" type="button" on:click={openOutShow} on:keydown={handleLabelKeydown}>
                            <span class="label-text">{outShowName}</span>
                        </button>
                    {:else}
                        <div class="current-show-label disabled">
                            <span class="label-text">{outShowName}</span>
                        </div>
                    {/if}
                </div>
            {/if}
        </div>

        {#if $outShow && layout}
            <div class="outSlides">
                {#if $outShow && $outLayout && nextSlide(layout, outNumber) && getNextSlide($outShow, outNumber, $outLayout)}
                    <Slide outSlide={nextSlide(layout, outNumber) || 0} {transition} preview />
                {:else}
                    <div style="display: flex;align-items: center;justify-content: center;flex: 1;opacity: 0.5;padding: 20px 0;">{translate("remote.end", $dictionary)}</div>
                {/if}
            </div>
        {/if}

</div>

<style>
    .right-panel {
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        overflow: hidden;
        background-color: var(--primary-darker);
    }

    .flex {
        position: relative;
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
    }

    .outSlides {
        display: flex;
        width: 100%;
    }

    .controls {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 0.5rem 0.75rem;
        background-color: var(--primary-darkest);
        border-radius: 12px;
        margin: 8px 8px 0 8px;
    }

    .nav-buttons {
        display: flex;
        align-items: center;
        justify-content: space-around;
        gap: 6px;
    }

    .nav-buttons :global(button) {
        min-height: auto !important;
        padding: 0.4rem 0.6rem !important;
    }

    .counter {
        flex: 1;
        text-align: center;
        opacity: 0.8;
        font-size: 1em;
        font-weight: 500;
    }

    .current-show-label {
        width: 100%;
        border: none;
        background: transparent;
        color: white;
        font-size: 0.95em;
        font-weight: 600;
        padding: 4px 6px 2px 6px;
        text-align: center;
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
        line-height: 1.2;
    }

    .current-show-label.disabled,
    .current-show-label:disabled {
        opacity: 0.6;
        cursor: default;
    }

    .current-show-label .label-text {
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
</style>
