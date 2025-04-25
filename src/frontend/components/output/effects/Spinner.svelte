<script>
    // SOURCE: https://gist.github.com/rniswonger/185039aa4d2fe49e3b1f578a4d495f6e

    import { rays } from "./spinner"
    import EffectCanvas from "./EffectCanvas.svelte"

    let canvas
    $: if (canvas) rays.init(canvas, "#ffffff", "#ffff00")
</script>

<EffectCanvas bind:canvas />
