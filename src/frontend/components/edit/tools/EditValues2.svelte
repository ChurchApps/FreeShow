<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { translateText } from "../../../utils/language"
    import { clone } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import Input from "../../input/Input.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialFontDropdown from "../../inputs/MaterialFontDropdown.svelte"
    import type { EditInput2 } from "../values/boxes"

    export let sections: any = {}
    export let styles: { [key: string]: string } = {}
    // export let defaultSections: any = {}
    export let item: any = {}

    $: console.log(sections)

    function getValue(input: EditInput2, _updater: any) {
        if (input.type === "toggle") {
            return input.value
        }
        // if (input.id === "auto" && isAuto) return true
        // if (input.id?.includes(".")) input.value = getItemValue(input)

        // if (input.valueIndex !== undefined && styles[input.key || ""]) return removeExtension(styles[input.key!].split(" ")[input.valueIndex], input.extension)
        // if (input.input === "dropdown") return input.values.options.find((a) => a.id === getKeyValue(input))?.name || "—"
        // if (input.input === "checkbox") return !!input.value // closed
        // if (input.id === "filter" || input.id === "backdrop-filter") return item?.filter ? getFilters(item.filter || "")[input.key || ""] || input.value : input.value

        const defaultValue = input.value

        if (input.key) return styles[input.key || ""] ?? defaultValue
        return input.values.value ?? item[input.id] ?? defaultValue
    }

    function toggle(input: any) {
        let value = styles[input.key || ""] || ""

        let exists: number = value.indexOf(input.value)
        if (exists > -1) value = value.slice(0, exists) + value.substring(exists + input.value.length)
        else value = value + " " + input.value
        value = value.trim()

        // changed({ detail: value }, input)
        input.values.value = value
        dispatch("change", clone(input))
    }

    const dispatch = createEventDispatcher()
    function changed(e: any, input: any) {
        let value = e.detail

        if (input.extension) value += input.extension

        console.log("UPDATE", value, input)
        input.values.value = value
        dispatch("change", clone(input))

        input.values.value = e.detail
    }

    $: sectionValues = Object.entries(sections) as [string, any]
</script>

<div class="tools">
    {#each sectionValues as [id, section]}
        {#if id !== "default"}
            <p>{id}</p>
        {/if}

        {#each section.inputs as inputRow}
            <InputRow>
                {#each inputRow as input}
                    {#if !input.hidden}
                        {@const value = getValue(input, { styles, item })}

                        {#if input.type === "fontDropdown"}
                            <MaterialFontDropdown label={input.values.label} {value} style={input.values.style} fontStyleValue={input.styleValue} on:change={(e) => changed(e, input)} on:fontStyle={(e) => changed(e, { ...input, key: "font" })} />
                        {:else if input.type === "toggle"}
                            <MaterialButton style="min-width: 50px;flex: 1;" title={translateText(input.values.label)} on:click={() => toggle(input)}>
                                <Icon id={input.values.icon} size={1.2} white />
                                <div class="highlight" class:active={styles[input.key || ""]?.includes(value)}></div>
                            </MaterialButton>
                        {:else}
                            <Input input={{ type: input.type, value, ...input.values }} on:change={(e) => changed(e, input)} />
                        {/if}
                    {/if}
                {/each}
            </InputRow>
        {/each}
    {/each}
</div>

<style>
    .tools {
        padding: 10px;
    }

    /* toggle */

    .highlight {
        position: absolute;
        bottom: 5px;
        left: 50%;
        transform: translateX(-50%);

        height: 2px;
        width: 80%;

        background-color: var(--primary-lighter);
        transition: 0.2s background-color ease;
    }
    .highlight.active {
        background-color: var(--secondary);

        box-shadow: 0 0 3px rgb(255 255 255 / 0.2);
    }
</style>
