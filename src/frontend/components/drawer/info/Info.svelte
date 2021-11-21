<script lang="ts">
  import { activeShow, shows } from "../../../stores"
  import Clock from "../../system/Clock.svelte"
  import Date from "../../system/Date.svelte"
  import ScriptureInfo from "./ScriptureInfo.svelte"
  import ShowInfo from "./ShowInfo.svelte"

  export let id: string
  export let bible: any

  // ! IF show is show and not video.........
  $: show = $activeShow ? $shows[$activeShow.id] : null // type !== private.....

  $: console.log(id)
</script>

<!-- TODO: info tabs: clock, quick settings (master volume), local info -->

<div class="main">
  <div class="padding">
    {#if id === "shows" && show !== null}
      <ShowInfo />
    {:else if id === "scripture"}
      <ScriptureInfo {bible} />
    {:else}
      <div class="center">
        <Clock />
        <Date />
      </div>
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

  .center {
    display: flex;
    flex-direction: column;
    text-align: center;
    flex: 1;
    justify-content: center;
  }
</style>
