<script lang="ts">
  import type { Resolution } from "../../../types/Settings"
  import { screen } from "../../stores"

  export let slide: any = null

  let width: number = 0
  let height: number = 0
  let resolution: Resolution = slide && slide.settings.resolution ? slide.settings.size : $screen.resolution
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
