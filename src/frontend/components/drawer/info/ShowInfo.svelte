<script lang="ts">
  import { activeShow, categories, shows, showsCache, templates } from "../../../stores"
  import { _show } from "../../helpers/shows"
  import T from "../../helpers/T.svelte"
  import Date from "../../system/Date.svelte"

  $: show = $shows[$activeShow!.id]
  $: fullShow = $showsCache[$activeShow!.id]

  $: created = show?.timestamps.created || null
  $: modified = show?.timestamps.modified || null
  $: used = show?.timestamps.used || null

  let words: number = 0
  let allLines: any[]
  $: if (fullShow) allLines = _show($activeShow!.id).slides().items().lines().get()
  $: if (allLines) getWords()

  function getWords() {
    words = 0
    allLines.forEach((lines: any) => {
      lines.forEach((line: any) => {
        line?.text?.forEach((text: any) => (words += text.value.split(" ").length))
      })
    })
  }
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
  <span class="title"><T id={"info.created"} /></span>
  {#if created}
    <Date d={created} />
  {:else}
    <span>—</span>
  {/if}
</p>
<p>
  <span class="title"><T id={"info.modified"} /></span>
  {#if modified}
    <Date d={modified} />
  {:else}
    <span>—</span>
  {/if}
</p>
<p>
  <span class="title"><T id={"info.used"} /></span>
  {#if used}
    <Date d={used} />
  {:else}
    <span>—</span>
  {/if}
</p>
<p>
  <span class="title"><T id={"info.category"} /></span>
  <span>
    {#if show?.category}
      {#if $categories[show?.category]}
        {#if $categories[show?.category].default}
          <T id={$categories[show?.category].name} />
        {:else}
          {$categories[show?.category].name}
        {/if}
      {:else}
        <T id="error.not_found" />
      {/if}
    {:else}
      —
    {/if}
  </span>
</p>
<p>
  <span class="title"><T id={"info.slides"} /></span>
  <span>{Object.keys(fullShow?.slides || {}).length}</span>
</p>
<p>
  <span class="title"><T id={"info.words"} /></span>
  <span>{words}</span>
</p>
<p>
  <span class="title"><T id={"info.template"} /></span>
  <span>
    {#if fullShow?.settings?.template}
      {#if $templates[fullShow?.settings.template]}
        {$templates[fullShow?.settings.template]?.name}
      {:else}
        <T id="error.not_found" />
      {/if}
    {:else}
      —
    {/if}
  </span>
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
