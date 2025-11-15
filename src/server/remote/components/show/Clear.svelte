<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte"
    import { slide } from "svelte/transition"
    import Button from "../../../common/components/Button.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import { translate } from "../../util/helpers"
    import { send } from "../../util/socket"
    import { dictionary, isCleared, outData } from "../../util/stores"

    export let tablet: boolean = false
    export let locked: boolean = false
    export let outSlide: null | number = null

    let moreOptions: boolean = false

    onMount(() => send("API:get_cleared"))
    $: if (moreOptions) send("API:get_cleared")

    let dispatch = createEventDispatcher()
    function clear(id: string) {
        send(id)
        send("API:get_cleared")
        dispatch("clear")
    }

    $: type = $outData?.slide?.type
</script>

<div class="clear" class:tablet>
    {#if moreOptions || tablet}
        <div class="more" style="display: flex;" in:slide={{ duration: tablet ? 0 : 300 }}>
            <!-- WIP get state -->
            {#if type !== "pdf"}
                <Button
                    disabled={locked || $isCleared.background}
                    on:click={() => {
                        if (locked) return

                        clear("API:clear_background")
                        // outBackground = null
                    }}
                    red
                    dark
                    center
                    compact
                >
                    <Icon id="background" size={1.2} />
                </Button>
            {/if}

            <Button
                disabled={locked || !(outSlide || !$isCleared.slide)}
                on:click={() => {
                    if (locked) return

                    clear("API:clear_slide")
                    // outSlide = null
                }}
                red
                dark
                center
                compact
            >
                <Icon id={type === "pdf" ? "background" : "slide"} size={1.2} />
            </Button>

            <Button
                disabled={locked || $isCleared.overlays}
                on:click={() => {
                    if (locked) return

                    clear("API:clear_overlays")
                    // outOverlays = []
                }}
                red
                dark
                center
                compact
            >
                <Icon id="overlays" size={1.2} />
            </Button>
        </div>
    {/if}

    <span style="display: flex;">
        <Button class="clearAll" disabled={locked || !(outSlide || !$isCleared.all)} on:click={() => clear("API:clear_all")} red dark center>
            <Icon id="clear" size={1.2} />
            <span style="padding-inline-start: 10px; font-size: 1em; font-weight: 500;">{translate("clear.all", $dictionary)}</span>
        </Button>

        {#if !tablet}
            <Button disabled={locked || !(outSlide || !$isCleared.all)} on:click={() => (moreOptions = !moreOptions)} style="flex: 0;" dark center compact>
                <Icon id="expand" style="transition: transform .2s;{moreOptions ? 'transform: rotate(180deg);' : ''}" size={1.1} />
            </Button>
        {/if}
    </span>
</div>

<style>
    .clear {
        display: flex;
        flex-direction: column;
        width: 100%;
        gap: 4px;
        padding-bottom: 4px;
    }
    .clear :global(button) {
        width: 100%;
        flex: 1;
    }
    .clear :global(.clearAll) {
        padding: 0.5rem 1rem !important;
        font-size: 0.9em !important;
        background-color: #661a26 !important;
        color: white !important;
        min-height: auto !important;
    }
    .clear :global(.clearAll) :global(svg) {
        width: 20px;
        height: 20px;
        fill: white !important;
    }
    .clear :global(.clearAll) :global(span) {
        color: white !important;
    }

    .clear.tablet {
        flex-direction: column-reverse;
    }
</style>
