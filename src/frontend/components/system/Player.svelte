<script lang="ts">
  import { playerVideos } from "../../stores"
  import Vimeo from "../drawer/player/Vimeo.svelte"
  import YouTube from "../drawer/player/YouTube.svelte"

  export let id: string
  export let preview: boolean = false

  $: video = $playerVideos[id]

  export let videoData = { muted: true, paused: false, loop: false, duration: 0 }
  export let videoTime: number = 0
  export let title: string = ""
  export let startAt: number = 0
</script>

{#if video?.type === "youtube"}
  <YouTube playerId={id} id={video.id} bind:videoData bind:videoTime bind:title {startAt} {preview} />
{:else if video?.type === "vimeo"}
  <Vimeo id={video.id} bind:videoData bind:videoTime bind:title {startAt} {preview} />
{/if}
