<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte"
    import { slide } from "svelte/transition"
    import Button from "../../../common/components/Button.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import { translate } from "../../util/helpers"
    import { send } from "../../util/socket"
    import { dictionary, isCleared } from "../../util/stores"

    export let tablet: boolean = false
    export let locked: boolean = false
    export let outSlide: null | number = null

    let moreOptions: boolean = false

    onMount(() => send("API:get_cleared"))
    $: if (moreOptions) send("API:get_cleared")

    let dispatch = createEventDispatcher()
    function clear(id: string, value?: any) {
        send(id, value)
        send("API:get_cleared")
        dispatch("clear")
    }
</script>

<div class="clear" class:tablet>
    {#if moreOptions || tablet}
        <div class="more" style="display: flex;" in:slide={{ duration: tablet ? 0 : 300 }}>
            <!-- WIP get state -->
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
            >
                <Icon id="background" size={1.2} />
            </Button>

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
            >
                <Icon id="slide" size={1.2} />
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
            >
                <Icon id="overlays" size={1.2} />
            </Button>
        </div>
    {/if}

    <span style="display: flex;">
        <Button class="clearAll" disabled={locked || !(outSlide || !$isCleared.all)} on:click={() => clear("OUT", "clear")} red dark center>
            <Icon id="clear" size={1.2} />
            <span style="padding-left: 10px;">{translate("clear.all", $dictionary)}</span>
        </Button>

        {#if !tablet}
            <Button on:click={() => (moreOptions = !moreOptions)} style="flex: 0;">
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
        font-size: 0.7em;
    }
    .clear :global(button) {
        width: 100%;
        flex: 1;
        padding: 0.5em 0.8em;
    }

    .clear.tablet {
        flex-direction: column-reverse;
    }
</style>
