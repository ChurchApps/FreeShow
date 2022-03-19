<script lang="ts">
  import { FILE_INFO } from "../../../../types/Channels"
  import { activeShow } from "../../../stores"
  import { formatBytes } from "../../helpers/bytes"
  import T from "../../helpers/T.svelte"
  import Date from "../../system/Date.svelte"

  $: name = $activeShow!.name || ""
  $: if ($activeShow?.id) window.api.send(FILE_INFO, $activeShow!.id)
  let info: any = {}
  window.api.receive(FILE_INFO, (data: any) => {
    info = { ...data.stat, extension: data.extension }
  })
  $: console.log(info)

  $: size = info.size || 0
  $: created = info.birthtime || null
  // $: accessed = info.atime || null
  $: modified = info.mtime || null
  $: changed = info.ctime || null
</script>

<h2 style="text-align: center" title={name}>
  {#if name.length}
    {name}
  {:else}
    <span style="opacity: 0.5">
      <T id={"main.unnamed"} />
    </span>
  {/if}
</h2>
<p>
  <span class="title"><T id={"info.extension"} /></span>
  <span style="text-transform: uppercase;">{info.extension || "-"}</span>
</p>
<p>
  <span class="title"><T id={"info.size"} /></span>
  <span>{formatBytes(size)}</span>
</p>
<p>
  <span class="title"><T id={"info.created"} /></span>
  {#if created}
    <Date d={created} />
  {:else}
    <span>-</span>
  {/if}
</p>
<p>
  <span class="title"><T id={"info.modified"} /></span>
  {#if modified}
    <Date d={modified} />
  {:else}
    <span>-</span>
  {/if}
</p>
<p>
  <span class="title"><T id={"info.changed"} /></span>
  {#if changed}
    <!-- format="d,m,y" -->
    <Date d={changed} />
  {:else}
    <span>-</span>
  {/if}
</p>

<style>
  p {
    display: flex;
    justify-content: space-between;
  }

  .title {
    opacity: 0.8;
  }
</style>
