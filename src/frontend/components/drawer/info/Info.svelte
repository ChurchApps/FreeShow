<script lang="ts">
  import { activeShow } from "../../../stores"
  import Center from "../../system/Center.svelte"
  import Clock from "../../system/Clock.svelte"
  import Date from "../../system/Date.svelte"
  import MediaInfo from "./MediaInfo.svelte"
  import ScriptureInfo from "./ScriptureInfo.svelte"
  import ShowInfo from "./ShowInfo.svelte"

  export let id: string
  export let bible: any
</script>

<!-- TODO: info tabs: clock, quick settings (master volume), local info -->

<div class="main">
  <div class="padding">
    {#if id === "shows" && ($activeShow?.type === null || $activeShow?.type === "private")}
      <ShowInfo />
    {:else if id === "backgrounds" && ($activeShow?.type === "video" || $activeShow?.type === "image")}
      <MediaInfo />
    {:else if id === "scripture"}
      <ScriptureInfo {bible} />
    {:else}
      <Center>
        <Clock />
        <Date />
      </Center>
    {/if}
  </div>
</div>

<style>
  .main {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
  }

  .padding {
    display: flex;
    flex-direction: column;
    flex: 1;
    padding: 10px;
  }
</style>
