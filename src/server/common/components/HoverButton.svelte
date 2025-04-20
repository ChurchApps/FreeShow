<script lang="ts">
    import { onMount } from "svelte"
    import Icon from "./Icon.svelte"

    export let icon: string
    export let size: number = 5

    // fade out (to show itself)
    let reveal = true
    onMount(startFade)
    function startFade() {
        setTimeout(() => {
            reveal = false
        }, 800)
    }
</script>

<button type="button" style={$$props.style} title={$$props.title} {...$$restProps}>
    <slot />
    <div class="overlay" class:reveal>
        <Icon id={icon} {size} white />
    </div>
</button>

<style>
    div {
        width: 100%;
        height: 100%;
        position: relative;
    }

    .overlay.reveal {
        opacity: 0.2;
        transition: 2s opacity;
    }

    .overlay {
        cursor: pointer;
        position: absolute;
        top: 0;
        opacity: 0;
        transition: 0.2s opacity;
        background-color: rgb(0 0 0 / 0.5);

        display: flex;
        align-items: center;
        justify-content: center;
    }
    .overlay:hover {
        opacity: 0.8;
    }
</style>
