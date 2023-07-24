<script lang="ts">
    import { onMount } from "svelte"
    import { dictionary, fullColors, groupNumbers, groups } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import Color from "../../inputs/Color.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

    $: g = Object.entries($groups)
        .map(([id, a]: any) => ({ id, ...a, name: a.default ? $dictionary.groups?.[a.name] || a.name : a.name }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name))

    function changeGroup(e: any, id: string, key: string = "name") {
        // TODO: history
        groups.update((a) => {
            if (key === "name" && a[id].default) delete a[id].default

            let value = e.target?.value || e
            if (key === "shortcut") value = e.detail.name
            if (value === "—") value = ""

            a[id][key] = value

            return a
        })
    }

    const inputs: any = {
        colors: (e: any) => fullColors.set(e.target.checked),
        groupNumber: (e: any) => groupNumbers.set(e.target.checked),
    }

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

    const keys = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"]
    let shortcuts: any[] = [{ name: "—" }]

    onMount(() => {
        keys.forEach((key) => {
            shortcuts.push({ name: key })
        })
    })

    $: console.log(shortcuts)
    function addGroup() {
        // if (!value.group.length) {
        //     newToast("$toast.no_name")
        //     return
        // }

        let value: any = { group: "", groupColor: "#ffffff" }
        history({ id: "UPDATE", newData: { data: { name: value.group, color: value.groupColor } }, location: { page: "settings", id: "global_group" } })
        // value.group = ""
    }
</script>

<CombinedInput>
    <p><T id="settings.group_numbers" /></p>
    <div class="alignRight">
        <Checkbox checked={$groupNumbers} on:change={inputs.groupNumber} />
    </div>
</CombinedInput>
<CombinedInput>
    <p><T id="settings.full_colors" /></p>
    <div class="alignRight">
        <Checkbox checked={$fullColors} on:change={inputs.colors} />
    </div>
</CombinedInput>

<h3><T id="groups.global" /></h3>

{#each g as group}
    <CombinedInput>
        <TextInput style="flex: 3;" value={group.name} on:change={(e) => changeGroup(e, group.id)} />
        <!-- {#if group.default}
              <T id="groups.{group.name}" />
            {:else}
              {group.name}
            {/if} -->
        <Color value={group.color} on:input={(e) => changeGroup(e.detail, group.id, "color")} />
        <!-- shortcut -->
        <Dropdown title={$dictionary.settings?.group_shortcut} style="flex: 0.5;" value={group.shortcut || "—"} options={shortcuts} on:click={(e) => changeGroup(e, group.id, "shortcut")} center />
        <Button
            on:click={() => {
                history({ id: "UPDATE", newData: { id: group.id }, location: { page: "settings", id: "global_group" } })
            }}
        >
            <Icon id="delete" />
            <!-- <T id="actions.delete" /> -->
        </Button>
    </CombinedInput>
{/each}

<div class="filler" />
<div class="bottom">
    <div style="display: flex;">
        <Button style="width: 100%;" on:click={addGroup} center>
            <Icon id="add" right />
            <T id="settings.add" />
        </Button>
        <Button
            style="width: 100%;"
            center
            on:click={() => {
                fullColors.set(false)
                groupNumbers.set(true)
                groups.set(clone(defaultGroups))
            }}
        >
            <Icon id="reset" right />
            <T id="actions.reset" />
        </Button>
    </div>
</div>

<style>
    h3 {
        color: var(--text);
        text-transform: uppercase;
        text-align: center;
        font-size: 0.9em;
        margin: 20px 0;
    }

    .filler {
        height: 48px;
    }
    .bottom {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        background-color: var(--primary-darkest);

        display: flex;
        flex-direction: column;
    }
</style>
