<script lang="ts">
  import { dictionary, language } from "../../stores"

  export let id: string
  // let pre = '', suf = '';
  let category: string, key: string
  // if (id.includes('$:')) {
  //   pre = id.slice(0, id.indexOf('$:'));
  //   suf = id.slice(id.indexOf(':$') + 2, id.length);
  //   id = id.slice(id.indexOf('$:') + 2, id.indexOf(':$'));
  //   let category = id.slice(0, id.indexOf('.'));
  //   let key = id.slice(id.indexOf('.') + 1, id.length);
  // }
  if (id.includes(".")) {
    category = id.slice(0, id.indexOf(".")).replace("$:", "")
    key = id.slice(id.indexOf(".") + 1, id.length).replace(":$", "")
  }
</script>

{#key language}
  {$dictionary[category]?.[key] || `[${id}]`}
{/key}
<!-- {#if $dictionary[category]?.[key]}
  {pre}{$dictionary[category]?.[key]}{suf}
{:else if id.includes('.')}
  {`${pre}[${id}]${suf}`}
{:else}
  {id}
{/if} -->
