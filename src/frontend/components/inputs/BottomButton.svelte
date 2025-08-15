<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { drawer, openedFolders } from "../../stores"
    import MaterialButton from "./MaterialButton.svelte"

    export let title: string = ""
    export let icon: string = ""
    export let disabled: boolean = false
    export let scrollElem: HTMLElement | null = null

    const dispatch = createEventDispatcher()
    function click(e, border: boolean = false) {
        if (disabled) return
        if (border && e.target?.closest("button")) return

        const ctrl = !!e.detail?.ctrl
        const shift = !!e.detail?.shift
        dispatch("click", { ctrl, shift })
    }

    let scrollActive = false
    $: drawerHeight = $drawer.height
    $: if (scrollElem || drawerHeight || $openedFolders) setTimeout(updateScroll, 20)
    function updateScroll() {
        if (!scrollElem) return
        scrollActive = scrollElem.scrollHeight > scrollElem.clientHeight
    }
</script>

<div class="bottom" class:scrollActive on:click={(e) => click(e, true)}>
    <div class="buttonDiv">
        <!-- variant="contained" -->
        <MaterialButton variant="outlined" class={$$props.class} style={$$props.style} {title} {icon} {disabled} on:click={click} small>
            <slot />
        </MaterialButton>
    </div>
</div>

<style>
    .bottom {
        position: absolute;
        bottom: 0;
        width: 100%;

        padding: 5px;
        padding-top: 0;
    }
    .bottom:not(.large).scrollActive {
        /* don't obstruct scroll bar */
        width: calc(100% - 8px);
    }
    .bottom.large {
        padding: 10px;
        padding-top: 0;
        padding-left: 0;

        right: 0;
        width: auto;
    }
    .bottom.large.scrollActive {
        right: 8px;
    }

    .buttonDiv {
        background-color: var(--primary-darkest);
        border-radius: 4px;

        box-shadow: 1px 1px 2px rgb(0 0 0 / 0.3);
    }
    .bottom.large .buttonDiv {
        box-shadow: 1px 1px 3px rgb(0 0 0 / 0.6);
        border-radius: 50px;
    }

    .bottom :global(button) {
        width: 100%;
    }
</style>
