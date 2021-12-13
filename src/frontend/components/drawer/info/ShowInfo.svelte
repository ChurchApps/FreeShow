<script>
  import { activeShow, shows } from "../../../stores"
  import T from "../../helpers/T.svelte"
  import Date from "../../system/Date.svelte"

  $: show = $shows[$activeShow.id]
</script>

<h2 style="text-align: center">
  {#if show.name.length}
    {show.name}
  {:else}
    <span style="opacity: 0.5">
      <T id={"main.unnamed"} />
    </span>
  {/if}
</h2>
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

<style>
  p {
    display: flex;
    justify-content: space-between;
  }
</style>
