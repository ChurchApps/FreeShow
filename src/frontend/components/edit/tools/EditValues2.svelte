<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { translateText } from "../../../utils/language"
    import { clone } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import Input from "../../input/Input.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialFontDropdown from "../../inputs/MaterialFontDropdown.svelte"
    import type { EditBoxSection, EditInput2 } from "../values/boxes"

    export let sections: { [key: string]: EditBoxSection } = {}
    export let styles: { [key: string]: string } = {}
    export let customValues: { [key: string]: string } = {}
    // export let defaultSections: any = {}
    export let item: any = {}

    $: console.log(sections)

    function getValue(input: EditInput2, _updater: any = null) {
        if (input.type === "toggle") return styles[input.key || ""] || ""
        if (input.type === "radio") return customValues[input.key || ""] || ""

        // if (input.id === "auto" && isAuto) return true
        // if (input.id?.includes(".")) input.value = getItemValue(input)

        // if (input.valueIndex !== undefined && styles[input.key || ""]) return removeExtension(styles[input.key!].split(" ")[input.valueIndex], input.extension)
        // if (input.input === "dropdown") return input.values.options.find((a) => a.id === getKeyValue(input))?.name || "—"
        // if (input.input === "checkbox") return !!input.value // closed
        // if (input.id === "filter" || input.id === "backdrop-filter") return item?.filter ? getFilters(item.filter || "")[input.key || ""] || input.value : input.value

        const defaultValue = input.value

        let value: any = null
        if (input.key) value = styles[input.key || ""] ?? defaultValue
        else value = input.values.value ?? item[input.id] ?? defaultValue

        if (input.type === "number") value = Number(value)

        if (input.multiplier) value *= input.multiplier

        return value
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

    function radio(input: any) {
        let value = input.value
        input.values.value = value
        dispatch("change", clone(input))
    }

    const dispatch = createEventDispatcher()
    function changed(e: any, input: any) {
        let value = e.detail

        if (input.multiplier) value = value / input.multiplier
        if (input.extension) value += input.extension

        console.log("UPDATE", value, input)
        input.values.value = value
        dispatch("change", clone(input))

        input.values.value = e.detail
    }

    function hasChangedValues(id, _updater: any) {
        let allInputsToCheck: EditInput2[] = []
        let filterOut: string[] = []

        sections[id].inputs.flat().forEach((input) => {
            if (filterOut.includes(input.key || "")) return
            if (input.type === "radio") filterOut.push(input.key || "")
            allInputsToCheck.push(input)
        })

        const hasChanged = !!allInputsToCheck.find((a, i) => !isDefaultValue(a, sections[id].defaultValues?.[i]))
        if (hasChanged && !openedSections.includes(id)) openedSections.push(id)
        return hasChanged
    }

    function isDefaultValue(input: EditInput2, defaultValue: any) {
        if (!defaultValue) defaultValue = input.value
        const currentValue = getValue(input)

        if (input.type === "toggle") {
            return currentValue?.includes(defaultValue)
        }

        if (input.multiplier) defaultValue *= input.multiplier

        if (currentValue !== defaultValue) console.log(input, currentValue, defaultValue) // DEBUG
        return currentValue === defaultValue
    }

    function resetSection(id: string) {
        sections[id].inputs.forEach((inputRow, rowIndex) => {
            inputRow.forEach((input) => {
                let defaultValue = sections[id].defaultValues?.[rowIndex] ?? input.value

                if (input.type === "radio" && input.value !== defaultValue) return

                if (input.multiplier) defaultValue *= input.multiplier

                console.log(input, defaultValue)
                changed({ detail: defaultValue }, input)
            })
        })

        // toggleSection(id)
    }

    let openedSections: string[] = []
    function toggleSection(id: string) {
        const activeIndex = openedSections.indexOf(id)
        if (activeIndex < 0) openedSections.push(id)
        else openedSections.splice(activeIndex, 1)

        openedSections = openedSections
    }

    $: sectionValues = Object.entries(sections)
</script>

<div class="tools">
    {#each sectionValues as [id, section]}
        {@const hasChanged = hasChangedValues(id, { styles, item })}
        {@const expanded = id === "default" || openedSections.includes(id)}

        <div class="section">
            {#if id !== "default"}
                <div class="title">
                    <MaterialButton style="width: 100%;{hasChanged ? 'padding: 4px 12px;' : 'padding: 8px 12px;'}" disabled={hasChanged} on:click={() => toggleSection(id)}>
                        <span style="display: flex;gap: 8px;align-items: center;">
                            <Icon {id} white />
                            <p>{translateText("edit." + id)}</p>
                        </span>

                        {#if hasChanged}
                            <MaterialButton title="actions.reset" style="pointer-events: all;padding: 4px;" on:click={() => resetSection(id)}>
                                <Icon id="reset" size={0.8} white />
                            </MaterialButton>
                        {:else}
                            <Icon id="arrow_back_modern" class={expanded ? "open" : ""} size={0.6} style="opacity: 0.5;" white />
                        {/if}
                    </MaterialButton>
                </div>
            {/if}

            {#if expanded}
                {#each section.inputs as inputRow}
                    <InputRow>
                        {#each inputRow as input}
                            {#if !input.hidden}
                                {@const value = getValue(input, { styles, item })}

                                {#if input.type === "fontDropdown"}
                                    <MaterialFontDropdown
                                        label={input.values.label}
                                        {value}
                                        style={input.values.style}
                                        fontStyleValue={input.styleValue}
                                        on:change={(e) => changed(e, input)}
                                        on:fontStyle={(e) => changed(e, { ...input, key: "font" })}
                                    />
                                {:else if input.type === "toggle"}
                                    <MaterialButton style="min-width: 50px;flex: 1;" title={translateText(input.values.label)} on:click={() => toggle(input)}>
                                        <Icon id={input.values.icon} size={1.2} white />
                                        <div class="highlight" class:active={value.includes(input.value)}></div>
                                    </MaterialButton>
                                {:else if input.type === "radio"}
                                    <MaterialButton style="min-width: 50px;flex: 1;" title={translateText(input.values.label)} on:click={() => radio(input)}>
                                        <Icon id={input.values.icon} size={1.2} white />
                                        <div class="highlight radio" class:active={value === input.value}></div>
                                    </MaterialButton>
                                {:else}
                                    <Input input={{ type: input.type, value, ...input.values }} on:change={(e) => changed(e, input)} />
                                {/if}
                            {/if}
                        {/each}
                    </InputRow>
                {/each}
            {/if}
        </div>
    {/each}
</div>

<style>
    .tools {
        padding: 8px 5px;

        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .title {
        background-color: var(--primary-darker);
        border-bottom: 1px solid var(--primary-lighter);

        border-top-left-radius: 10px;
        border-top-right-radius: 10px;
        overflow: hidden;
    }
    .title p {
        font-weight: 500;
        font-size: 0.8rem;
        opacity: 0.8;
    }

    .title :global(button) {
        display: flex;
        justify-content: space-between;

        /* when disabled */
        opacity: 1;
    }

    .title :global(svg) {
        transition: 0.1s transform ease;
    }
    .title :global(svg.open) {
        transform: rotate(-90deg);
    }

    .section {
        border: 1px solid var(--primary-lighter);

        border-radius: 6px;
        border-top-left-radius: 10px;
        border-top-right-radius: 10px;

        /* overflow: hidden; */
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
    .highlight.radio {
        width: 100%;
        bottom: 0;
    }
    .highlight.active {
        background-color: var(--secondary);

        box-shadow: 0 0 3px rgb(255 255 255 / 0.2);
    }
</style>
