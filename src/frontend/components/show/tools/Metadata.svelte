<script lang="ts">
  import { activeShow, shows } from "../../../stores"
  import T from "../../helpers/T.svelte"
  import TextInput from "../../inputs/TextInput.svelte"
  import Panel from "../../system/Panel.svelte"

  $: meta = $shows[$activeShow!.id].meta

  let values: any = {}

  $: {
    values = { title: "", artist: "", author: "", publisher: "", CCLI: "", year: "" }
    Object.entries(meta).forEach(([key, value]) => {
      values[key] = value
    })
  }

  const changeValue = (e: any, key: string) => {
    values[key] = e.target.value
  }
</script>

<Panel>
  <div class="gap" style="padding: 10px;">
    <span class="titles">
      {#each Object.keys(values) as key}
        <p><T id="meta.{key}" /></p>
      {/each}
    </span>
    <span style="flex: 1;display: flex;flex-direction: column;gap: 5px;">
      {#each Object.entries(values) as [key, value]}
        <TextInput {value} on:change={(e) => changeValue(e, key)} />
      {/each}
    </span>
  </div>
</Panel>
