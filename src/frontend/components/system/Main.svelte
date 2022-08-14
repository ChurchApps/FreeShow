<script lang="ts">
  import { outputs } from "../../stores"
  import { getResolution } from "../helpers/output"

  export let slide: any = null

  let width: number = 0
  let height: number = 0
  $: resolution = getResolution(slide?.settings?.resolution, $outputs)
</script>

<div class="main" bind:offsetWidth={width} bind:offsetHeight={height}>
  <slot {width} {height} {resolution} />
</div>

<style>
  .main {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
</style>
