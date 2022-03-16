<script lang="ts">
  import { uid } from "uid"
  import { dictionary, groups } from "../../../stores"
  import { history } from "../../helpers/history"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import Color from "../../inputs/Color.svelte"
  import TextInput from "../../inputs/TextInput.svelte"

  $: g = Object.entries($groups).map(([id, a]: any) => ({ id, ...a }))

  function changeGroup(e: any, id: string, key: string = "name") {
    groups.update((a) => {
      if (key === "name" && a[id].default) delete a[id].default
      a[id][key] = e.target.value
      return a
    })
  }

  const changeValue = (e: any, key: string) => (value[key] = e.target.value)
  let value: any = { group: "", groupColor: "#ffffff" }
</script>

<!-- <hr>
      <h3>Global Groups</h3> -->
{#each g as group}
  <div>
    <TextInput value={group.default ? $dictionary.groups[group.name] : group.name} on:change={(e) => changeGroup(e, group.id)} light />
    <!-- {#if group.default}
              <T id="groups.{group.name}" />
            {:else}
              {group.name}
            {/if} -->
    <Color value={group.color} on:input={(e) => changeGroup(e, group.id, "color")} style="width: 200px;" />
    <Button
      on:click={() => {
        history({ id: "addGlobalGroup", oldData: { id: group.id, data: { ...$groups[group.id] } } })
      }}
    >
      <T id="settings.remove" />
    </Button>
  </div>
{/each}
<hr />
<h3><T id="settings.add_group" /></h3>
<div>
  <TextInput value={value.group} on:input={(e) => changeValue(e, "group")} light />
  <Color value={value.groupColor} on:input={(e) => changeValue(e, "groupColor")} style="width: 200px;" />
</div>
<Button
  style="width: 100%;"
  center
  on:click={() => {
    if (value.group.length) history({ id: "addGlobalGroup", newData: { id: uid(), data: { name: value.group, color: value.groupColor } } })
  }}
>
  <T id="settings.add" />
</Button>

<style>
  h3 {
    text-align: center;
    font-size: 1.8em;
    margin: 20px 0;
  }
  h3 {
    font-size: initial;
  }

  hr {
    background-color: var(--primary-lighter);
    border: none;
    height: 2px;
    width: 100%;
    margin: 20px 0;
  }

  div:not(.scroll) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 5px 0;
  }
</style>
