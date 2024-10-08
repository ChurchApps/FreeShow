<script lang="ts">
    import { onMount } from "svelte"
    import { dictionary, fullColors, groupNumbers, groups, special, templates } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, sortByName } from "../../helpers/array"
    import { getList } from "../../../utils/common"
    import { history } from "../../helpers/history"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import Color from "../../inputs/Color.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

    $: g = sortByName(Object.entries($groups).map(([id, a]: any) => ({ ...a, id, name: a.default ? $dictionary.groups?.[a.name] || a.name : a.name })))

    function changeGroup(e: any, id: string, key: string = "name") {
        // remove default tag if name is changed (used for translation)
        // WIP undo won't work here...
        if (key === "name" && $groups[id].default) {
            groups.update((a) => {
                delete a[id].default

                return a
            })
        }

        let value = e?.target?.value || e
        if (key === "shortcut") value = e.detail.name
        if (value === "—") value = ""

        history({ id: "UPDATE", newData: { key, data: value }, oldData: { id: id }, location: { page: "settings", id: "global_group", override: "group_" + key } })
    }

    const inputs = {
        colors: (e: any) => fullColors.set(e.target.checked),
        groupNumber: (e: any) => groupNumbers.set(e.target.checked),
        numberKeys: (e: any) => updateSpecial(e.target.checked, "numberKeys"),
        capitalizeWords: (e: any) => updateSpecial(e.target.value || "", "capitalize_words"),
    }

    function updateSpecial(value, key) {
        special.update((a) => {
            a[key] = value
            return a
        })
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

    function reset() {
        fullColors.set(false)
        groupNumbers.set(true)

        groups.set(clone(defaultGroups))

        special.update((a) => {
            delete a.numberKeys
            a.capitalize_words = "Jesus, Lord" // updateSettings.ts
            return a
        })
    }

    let templateList: any[] = []
    $: console.log($templates, templateList)
    $: templateList = getList($templates, true)
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
<CombinedInput>
    <p><T id="settings.slide_number_keys" /></p>
    <div class="alignRight">
        <Checkbox checked={$special.numberKeys} on:change={inputs.numberKeys} />
    </div>
</CombinedInput>

<CombinedInput>
    <p title={$dictionary.settings?.comma_seperated}><T id="settings.capitalize_words" /></p>
    <TextInput value={$special.capitalize_words || ""} on:change={inputs.capitalizeWords} />
</CombinedInput>

<h3><T id="groups.global" /></h3>

{#each g as group, i}
    {#if i === 0}
        <div class="titles">
            <p style="width: 35%;"><T id="inputs.name" /></p>
            <p style="width: 15%;"><T id="edit.color" /></p>
            <p style="width: 20%;"><T id="groups.group_shortcut" /></p>
            <p style="width: 25%;"><T id="groups.group_template" /></p>
            <!-- <p></p> -->
        </div>
    {/if}

    <CombinedInput>
        <!-- name -->
        <TextInput style="width: 35%;" value={group.name} on:change={(e) => changeGroup(e, group.id)} />
        <!-- color -->
        <Color style="width: 15%;" value={group.color} on:input={(e) => changeGroup(e.detail, group.id, "color")} />
        <!-- shortcut -->
        <span style="width: 20%;">
            <Dropdown title={$dictionary.settings?.group_shortcut} value={group.shortcut || "—"} options={shortcuts} on:click={(e) => changeGroup(e, group.id, "shortcut")} center />
        </span>
        <!-- template -->
        <span style="width: 25%;">
            <Dropdown title={$dictionary.groups?.group_template} value={templateList.find((a) => a.id === group.template)?.name || "—"} options={templateList} on:click={(e) => changeGroup(e.detail.id, group.id, "template")} center />
        </span>
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
        <Button style="width: 100%;" center on:click={reset}>
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

    .titles {
        background: var(--hover);
        display: flex;
        padding: 8px 0;
        font-weight: 600;
        font-size: 0.9em;
    }

    .titles p {
        text-align: center;
    }
</style>
