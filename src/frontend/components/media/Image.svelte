<script lang="ts">
  import type { MediaFit } from "../../../types/Main"

  export let path: string
  export let filter: string = ""
  export let flipped: boolean = false
  export let fit: MediaFit = "contain"
</script>

<img class="media" style="object-fit: {fit};width: 100%;height: 100%;filter: {filter};{flipped ? 'transform: scaleX(-1);' : ''}" src={path} alt="" draggable="false" on:error />

<style>
  /* hide alt text */
  img {
    text-indent: 100%;
    white-space: nowrap;
    overflow: hidden;
  }
</style>
