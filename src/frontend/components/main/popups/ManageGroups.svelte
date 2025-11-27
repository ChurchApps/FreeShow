<script lang="ts">
    import { activePopup, groupNumbers, groups, groupsMoreOptionsEnabled, templates } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import T from "../../helpers/T.svelte"
    import { clone, sortByName } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialColorInput from "../../inputs/MaterialColorInput.svelte"
    import MaterialPopupButton from "../../inputs/MaterialPopupButton.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    $: g = sortByName(Object.entries($groups).map(([id, a]) => ({ ...a, id, name: a.default ? translateText("groups." + a.name) || a.name : a.name })))

    function changeGroup(e: any, id: string, key = "name") {
        // remove default tag if name is changed (used for translation)
        // WIP undo won't work here...
        if (key === "name" && $groups[id].default) {
            groups.update(a => {
                delete a[id].default

                return a
            })
        }

        let value = e?.target?.value || e
        // if (key === "shortcut") value = e.detail.name
        // if (value === "—") value = ""

        history({ id: "UPDATE", newData: { key, data: value }, oldData: { id: id }, location: { page: "none", id: "global_group", override: "group_" + key } })
    }

    const defaultGroups = {
        break: { name: "break", default: true, color: "#f5255e" },
        bridge: { name: "bridge", default: true, color: "#f52598", shortcut: "B" },
        chorus: { name: "chorus", default: true, color: "#f525d2", shortcut: "C" },
        intro: { name: "intro", default: true, color: "#d525f5" },
        outro: { name: "outro", default: true, color: "#a525f5" },
        pre_chorus: { name: "pre_chorus", default: true, color: "#8825f5" },
        tag: { name: "tag", default: true, color: "#7525f5" },
        verse: { name: "verse", default: true, color: "#5825f5", shortcut: "V" }
    }

    function addGroup() {
        // if (!value.group.length) {
        //     newToast("toast.no_name")
        //     return
        // }

        let value = { group: "", groupColor: "#ffffff" }
        history({ id: "UPDATE", newData: { data: { name: value.group, color: value.groupColor } }, location: { page: "none", id: "global_group" } })
        // value.group = ""
    }

    function reset() {
        groups.set(clone(defaultGroups))
        groupNumbers.set(true)
    }

    $: showMore = $groupsMoreOptionsEnabled
</script>

<MaterialButton class="popup-options {showMore ? 'active' : ''}" icon="options" iconSize={1.3} title={showMore ? "actions.close" : "create_show.more_options"} on:click={() => groupsMoreOptionsEnabled.set(!showMore)} white />

{#if showMore}
    <MaterialButton class="popup-reset" icon="reset" iconSize={1.1} title="actions.reset" on:click={reset} white />
{/if}

<div style="min-width: calc(100vw - var(--navigation-width) * 2 - 51px);">
    {#if showMore}
        <MaterialToggleSwitch style="margin-bottom: 10px;" label="settings.auto_group_numbers" checked={$groupNumbers} defaultValue={true} on:change={e => groupNumbers.set(e.detail)} />
    {/if}

    {#if g.length}
        {#each g as group}
            <InputRow>
                <MaterialTextInput label="inputs.name" style="flex: 1;" value={group.name} on:change={e => changeGroup(e.detail, group.id)} />
                <MaterialColorInput label="edit.color" noLabel style="flex: 0;min-width: 200px;" value={group.color} on:input={e => changeGroup(e.detail, group.id, "color")} />
                <MaterialPopupButton
                    label="groups.group_shortcut"
                    style="width: 28%;"
                    id={group.id}
                    value={group.shortcut}
                    name={(group.shortcut || "").toUpperCase()}
                    icon="shortcut"
                    popupId="assign_shortcut"
                    data={{
                        revert: $activePopup,
                        existingShortcuts: g.filter(a => a.id !== group.id && a.shortcut).map(a => a.shortcut),
                        mode: "global_group"
                    }}
                    on:change={e => changeGroup(e.detail, group.id, "shortcut")}
                    allowEmpty
                />
                <!-- template -->
                {#if showMore}
                    <MaterialPopupButton
                        label="groups.group_template"
                        style="width: 22%;"
                        value={group.template}
                        name={$templates[group.template || ""]?.name}
                        icon="templates"
                        popupId="select_template"
                        data={{
                            action: "select_template",
                            revert: $activePopup
                        }}
                        on:change={e => changeGroup(e.detail, group.id, "template")}
                        allowEmpty
                    />
                {/if}

                <MaterialButton
                    style="flex: 0;"
                    icon="delete"
                    title="actions.delete"
                    on:click={() => {
                        history({ id: "UPDATE", newData: { id: group.id }, location: { page: "none", id: "global_group" } })
                    }}
                    white
                />
            </InputRow>
        {/each}
    {:else}
        <div style="width: 100%;text-align: center;padding: 15px;opacity: 0.4;">
            <T id="empty.general" />
        </div>
    {/if}

    <MaterialButton variant="outlined" style="width: 100%;" icon="add" on:click={addGroup}>
        <T id="settings.add" />
    </MaterialButton>
</div>
