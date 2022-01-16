<script lang="ts">
  import { outputWindow, playerVideos } from "../../stores"
  import YouTube from "../drawer/player/YouTube.svelte"

  export let id: string

  $: video = $playerVideos[id]
  $: console.log(video?.id)

  export let videoData = { muted: true, paused: false, loop: false, duration: 0 }
  export let videoTime: number = 0
  export let title: string = ""
  export let startAt: number = 0

  if ($outputWindow) videoData.muted = true
</script>

{#if video?.type === "youtube"}
  <YouTube id={video.id} bind:videoData bind:videoTime bind:title {startAt} />
{/if}
