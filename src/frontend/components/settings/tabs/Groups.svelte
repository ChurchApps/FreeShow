<script lang="ts">
    import { activePopup, dictionary, fullColors, groupNumbers, groups, popupData, special, templates } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, sortByName } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import Color from "../../inputs/Color.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

    $: g = sortByName(Object.entries($groups).map(([id, a]) => ({ ...a, id, name: a.default ? $dictionary.groups?.[a.name] || a.name : a.name })))

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
        // if (key === "shortcut") value = e.detail.name
        // if (value === "—") value = ""

        history({ id: "UPDATE", newData: { key, data: value }, oldData: { id: id }, location: { page: "settings", id: "global_group", override: "group_" + key } })
    }

    const inputs = {
        colors: (e: any) => fullColors.set(e.target.checked),
        groupNumber: (e: any) => groupNumbers.set(e.target.checked),
        transparentSlides: (e: any) => updateSpecial(e.target.checked, "transparentSlides"),
        numberKeys: (e: any) => updateSpecial(e.target.checked, "numberKeys"),
        autoLetterShortcut: (e: any) => updateSpecial(e.target.checked, "autoLetterShortcut"),
        capitalizeWords: (e: any) => updateSpecial(e.target.value || "", "capitalize_words"),
    }

    function updateSpecial(value, key) {
        special.update((a) => {
            a[key] = value
            return a
        })
    }

    const defaultGroups = {
        break: { name: "break", default: true, color: "#f5255e" },
        bridge: { name: "bridge", default: true, color: "#f52598", shortcut: "B" },
        chorus: { name: "chorus", default: true, color: "#f525d2", shortcut: "C" },
        intro: { name: "intro", default: true, color: "#d525f5" },
        outro: { name: "outro", default: true, color: "#a525f5" },
        pre_chorus: { name: "pre_chorus", default: true, color: "#8825f5" },
        tag: { name: "tag", default: true, color: "#7525f5" },
        verse: { name: "verse", default: true, color: "#5825f5", shortcut: "V" },
    }

    function addGroup() {
        // if (!value.group.length) {
        //     newToast("$toast.no_name")
        //     return
        // }

        let value = { group: "", groupColor: "#ffffff" }
        history({ id: "UPDATE", newData: { data: { name: value.group, color: value.groupColor } }, location: { page: "settings", id: "global_group" } })
        // value.group = ""
    }

    function reset() {
        fullColors.set(false)
        groupNumbers.set(true)

        groups.set(clone(defaultGroups))

        special.update((a) => {
            delete a.numberKeys
            delete a.autoLetterShortcut
            a.capitalize_words = "Jesus, Lord" // updateSettings.ts
            return a
        })
    }
</script>

<CombinedInput>
    <p><T id="settings.group_numbers" /></p>
    <div class="alignRight">
        <Checkbox checked={$groupNumbers} on:change={inputs.groupNumber} />
    </div>
</CombinedInput>
<CombinedInput>
    <p><T id="settings.transparent_slides" /></p>
    <div class="alignRight">
        <Checkbox checked={$special.transparentSlides} on:change={inputs.transparentSlides} />
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
    <p><T id="settings.auto_shortcut_first_letter" /></p>
    <div class="alignRight">
        <Checkbox checked={$special.autoLetterShortcut} on:change={inputs.autoLetterShortcut} />
    </div>
</CombinedInput>

<CombinedInput>
    <p title={$dictionary.settings?.comma_seperated}><T id="settings.capitalize_words" /></p>
    <TextInput value={$special.capitalize_words || ""} on:change={inputs.capitalizeWords} />
</CombinedInput>

<h3><T id="groups.global" /></h3>

{#if g.length}
    {#each g as group, i}
        {#if i === 0}
            <div class="titles">
                <p style="width: 35%;"><T id="inputs.name" /></p>
                <p style="width: calc(15% + 5px);"><T id="edit.color" /></p>
                <p style="width: 20%;"><T id="groups.group_shortcut" /></p>
                <p style="width: 25%;"><T id="groups.group_template" /></p>
                <!-- <p></p> -->
            </div>
        {/if}

        <CombinedInput>
            <!-- name -->
            <TextInput style="width: 35%;" value={group.name} on:change={(e) => changeGroup(e, group.id)} />
            <!-- color -->
            <Color style="width: 100%;" value={group.color} on:input={(e) => changeGroup(e.detail, group.id, "color")} />
            <!-- shortcut -->
            <span style="width: 20%;display: flex;">
                <Button
                    on:click={() => {
                        popupData.set({ id: group.id, value: group.shortcut, existingShortcuts: g.filter((a) => a.id !== group.id && a.shortcut).map((a) => a.shortcut), mode: "global_group", trigger: (id) => changeGroup(id, group.id, "shortcut") })
                        activePopup.set("assign_shortcut")
                    }}
                    style="width: 100%;"
                    bold={!group.shortcut}
                >
                    <div style="display: flex;align-items: center;padding: 0;">
                        <Icon id="shortcut" style="margin-inline-start: 0.5em;" right />
                        <p>
                            {#if group.shortcut}
                                <span style="text-transform: uppercase;display: flex;align-items: center;">{group.shortcut}</span>
                            {:else}
                                <T id="popup.assign_shortcut" />
                            {/if}
                        </p>
                    </div>
                </Button>
                {#if group.shortcut}
                    <Button title={$dictionary.actions?.remove} on:click={() => changeGroup("", group.id, "shortcut")} redHover>
                        <Icon id="close" size={1.2} white />
                    </Button>
                {/if}
            </span>
            <!-- template -->
            <span style="width: 25%;display: flex;">
                <Button
                    on:click={() => {
                        popupData.set({ action: "select_template", active: group.template || "", trigger: (id) => changeGroup(id, group.id, "template") })
                        activePopup.set("select_template")
                    }}
                    style="width: 100%;"
                    bold={!group.template}
                >
                    <div style="display: flex;align-items: center;padding: 0;">
                        <Icon id="templates" style="margin-inline-start: 0.5em;" right />
                        <p>
                            {#if group.template}
                                {$templates[group.template || ""]?.name || "—"}
                            {:else}
                                <T id="popup.select_template" />
                            {/if}
                        </p>
                    </div>
                </Button>
                {#if group.template}
                    <Button title={$dictionary.actions?.remove} on:click={() => changeGroup("", group.id, "template")} redHover>
                        <Icon id="close" size={1.2} white />
                    </Button>
                {/if}
            </span>
            <Button
                on:click={() => {
                    history({ id: "UPDATE", newData: { id: group.id }, location: { page: "settings", id: "global_group" } })
                }}
                title={$dictionary.actions?.delete}
            >
                <Icon id="delete" />
                <!-- <T id="actions.delete" /> -->
            </Button>
        </CombinedInput>
    {/each}
{:else}
    <div style="width: 100%;text-align: center;padding: 15px;opacity: 0.4;">
        <T id="empty.general" />
    </div>
{/if}

<CombinedInput>
    <Button style="width: 100%;" on:click={addGroup} center dark>
        <Icon id="add" right />
        <T id="settings.add" />
    </Button>
</CombinedInput>

<div class="filler" />
<div class="bottom">
    <div style="display: flex;">
        <Button style="width: 100%;" center on:click={reset}>
            <Icon id="reset" right />
            <p><T id="actions.reset" /></p>
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
        inset-inline-start: 0;
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
