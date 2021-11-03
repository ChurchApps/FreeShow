<script lang="ts">
  import { activeShow, shows } from "../../stores"
  import T from "../helpers/T.svelte"
  import Clock from "../system/Clock.svelte"
  import Date from "../system/Date.svelte"

  // ! IF show is show and not video.........
  $: show = $activeShow ? $shows[$activeShow.id] : null // type !== private.....
</script>

<div class="main">
  <div class="padding">
    {#if show !== null}
      <h2 style="text-align: center">{show.name}</h2>
      <p><T id={"info.created"} />: <Date d={show.timestamps.created} /></p>
      <p>
        <T id={"info.modified"} />:
        {#if show.timestamps.modified}
          <Date d={show.timestamps.modified} />
        {:else}
          <span>-</span>
        {/if}
      </p>
      <p>
        <T id={"info.used"} />:
        {#if show.timestamps.used}
          <Date d={show.timestamps.used} />
        {:else}
          <span>-</span>
        {/if}
      </p>
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

  p {
    display: flex;
    justify-content: space-between;
  }

  .center {
    display: flex;
    flex-direction: column;
    text-align: center;
    flex: 1;
    justify-content: center;
  }
</style>
