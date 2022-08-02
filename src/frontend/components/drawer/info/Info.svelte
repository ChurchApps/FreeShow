<script lang="ts">
  import { activeShow } from "../../../stores"
  import Center from "../../system/Center.svelte"
  import Clock from "../../system/Clock.svelte"
  import Date from "../../system/Date.svelte"
  import AudioMix from "./AudioMix.svelte"
  import MediaInfo from "./MediaInfo.svelte"
  import PlayerInfo from "./PlayerInfo.svelte"
  import ScriptureInfo from "./ScriptureInfo.svelte"
  import ShowInfo from "./ShowInfo.svelte"
  import TemplateInfo from "./TemplateInfo.svelte"

  export let id: string
  export let bible: any
</script>

<!-- TODO: info tabs: clock, quick settings (master volume), local info -->

<div class="main">
  {#if id === "shows" && $activeShow !== null && ($activeShow.type === undefined || $activeShow.type === "show")}
    <ShowInfo />
  {:else if id === "media" && ($activeShow?.type === "video" || $activeShow?.type === "image")}
    <MediaInfo />
  {:else if id === "audio"}
    <AudioMix />
  {:else if id === "templates"}
    <TemplateInfo />
  {:else if id === "scripture"}
    <ScriptureInfo {bible} />
  {:else if id === "player"}
    <PlayerInfo />
  {:else}
    <Center>
      <Clock />
      <Date />
    </Center>
  {/if}
</div>

<style>
  div {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
  }
</style>
