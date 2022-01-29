<script>
  import { activeShow, shows } from "../../../stores"
  import T from "../../helpers/T.svelte"
  import Date from "../../system/Date.svelte"

  $: show = $shows[$activeShow.id]

  $: created = show?.timestamps.created || null
  $: modified = show?.timestamps.modified || null
  $: used = show?.timestamps.used || null
</script>

<h2 style="text-align: center" title={show?.name}>
  {#if show?.name.length}
    {show.name}
  {:else}
    <span style="opacity: 0.5">
      <T id={"main.unnamed"} />
    </span>
  {/if}
</h2>
<p>
  <T id={"info.created"} />
  {#if created}
    <Date d={created} />
  {:else}
    <span>-</span>
  {/if}
</p>
<p>
  <T id={"info.modified"} />
  {#if modified}
    <Date d={modified} />
  {:else}
    <span>-</span>
  {/if}
</p>
<p>
  <T id={"info.used"} />
  {#if used}
    <Date d={used} />
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
