<script>
  import { dictionary } from "../../stores";

  export let id;
  // let pre = '', suf = '';
  let category, key;
  // if (id.includes('$:')) {
  //   pre = id.slice(0, id.indexOf('$:'));
  //   suf = id.slice(id.indexOf(':$') + 2, id.length);
  //   id = id.slice(id.indexOf('$:') + 2, id.indexOf(':$'));
  //   let category = id.slice(0, id.indexOf('.'));
  //   let key = id.slice(id.indexOf('.') + 1, id.length);
  // }
  if (id.includes('.')) {
    category = id.slice(0, id.indexOf('.')).replace('$:', '');
    key = id.slice(id.indexOf('.') + 1, id.length).replace(':$', '');
  }
</script>

{$dictionary[category]?.[key] || `[${id}]`}
<!-- {#if $dictionary[category]?.[key]}
  {pre}{$dictionary[category]?.[key]}{suf}
{:else if id.includes('.')}
  {`${pre}[${id}]${suf}`}
{:else}
  {id}
{/if} -->