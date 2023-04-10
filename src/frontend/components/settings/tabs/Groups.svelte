<script lang="ts">
    import { dictionary, groups } from "../../../stores"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Color from "../../inputs/Color.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

    $: g = Object.entries($groups)
        .map(([id, a]: any) => ({ id, ...a, name: a.default ? $dictionary.groups?.[a.name] : a.name }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name))

    function changeGroup(e: any, id: string, key: string = "name") {
        groups.update((a) => {
            if (key === "name" && a[id].default) delete a[id].default
            a[id][key] = e.target.value
            return a
        })
    }

    const changeValue = (e: any, key: string) => (value[key] = e.target.value)
    let value: any = { group: "", groupColor: "#ffffff" }

    const defaultGroups: any = {
        break: { name: "break", default: true, color: "#f5255e" },
        bridge: { name: "bridge", default: true, color: "#f52598" },
        chorus: { name: "chorus", default: true, color: "#f525d2" },
        intro: { name: "intro", default: true, color: "#d525f5" },
        outro: { name: "outro", default: true, color: "#a525f5" },
        pre_chorus: { name: "pre_chorus", default: true, color: "#8825f5" },
        tag: { name: "tag", default: true, color: "#7525f5" },
        verse: { name: "verse", default: true, color: "#5825f5" },
    }
</script>

<!-- <h3><T id="settings.add_group" /></h3> -->
<div>
    <TextInput value={value.group} on:input={(e) => changeValue(e, "group")} light />
    <Color value={value.groupColor} on:input={(e) => changeValue(e, "groupColor")} style="width: 200px;" />
    <Button
        style="white-space: nowrap;"
        center
        on:click={() => {
            if (value.group.length) {
                history({ id: "UPDATE", newData: { data: { name: value.group, color: value.groupColor } }, location: { page: "settings", id: "global_group" } })
                value.group = ""
            }
        }}
    >
        <Icon id="add" right />
        <T id="settings.add" />
    </Button>
</div>

<hr />

{#each g as group}
    <div>
        <TextInput value={group.name} on:change={(e) => changeGroup(e, group.id)} light />
        <!-- {#if group.default}
              <T id="groups.{group.name}" />
            {:else}
              {group.name}
            {/if} -->
        <Color value={group.color} on:input={(e) => changeGroup(e, group.id, "color")} style="width: 200px;" />
        <Button
            on:click={() => {
                history({ id: "UPDATE", newData: { id: group.id }, location: { page: "settings", id: "global_group" } })
            }}
        >
            <T id="settings.remove" />
        </Button>
    </div>
{/each}
<hr />
<Button
    style="width: 100%;"
    center
    on:click={() => {
        groups.set(defaultGroups)
    }}
>
    <Icon id="reset" right />
    <T id="actions.reset" />
</Button>

<style>
    /* h3 {
    text-align: center;
    font-size: 1.8em;
    margin: 20px 0;
  }
  h3 {
    font-size: initial;
  } */

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
        gap: 5px;
    }
</style>
