<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { actions, activeEdit, timers } from "../../../stores"
    import { throttle } from "../../../utils/common"
    import { translateText } from "../../../utils/language"
    import { mediaExtensions } from "../../../values/extensions"
    import { getSortedTimers } from "../../drawer/timers/timers"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import { getFilters, getStyles } from "../../helpers/style"
    import Input from "../../input/Input.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialFilePicker from "../../inputs/MaterialFilePicker.svelte"
    import MaterialFontDropdown from "../../inputs/MaterialFontDropdown.svelte"
    import MaterialPopupButton from "../../inputs/MaterialPopupButton.svelte"
    import MaterialTextarea from "../../inputs/MaterialTextarea.svelte"
    import { parseShadowValue } from "../scripts/edit"
    import { filterItemStyle, mergeWithStyle } from "../scripts/itemClipboard"
    import type { EditBoxSection, EditInput2 } from "../values/boxes"
    import { sectionColors } from "../values/item"

    export let sections: { [key: string]: EditBoxSection } = {}
    export let styles: { [key: string]: string } = {}
    export let customValues: { [key: string]: string } = {}
    export let item: any = {}
    export let isStage = false

    function getValue(input: EditInput2, _updater: any = null) {
        if (input.type === "toggle") return styles[input.key || ""] || ""
        if (input.type === "radio") return customValues[input.key || ""] || ""
        if (input.id.includes("CSS")) return getStyleString(input)

        const defaultValue = input.value
        let value: any = null
        if (input.id === "filter" || input.id === "backdrop-filter") {
            value = getFilters(item[input.id] || getStyles(item.style)[input.id])?.[input.key || ""] || input.values.value || input.value
        } else if (input.key) {
            value = styles[input.key || ""]
            if (input.valueIndex !== undefined) {
                if (input.key === "box-shadow" || input.key === "text-shadow") {
                    const arr = parseShadowValue(value)
                    value = arr[input.valueIndex]
                } else {
                    value = value?.split(" ")[input.valueIndex]
                }
            }
            if (input.extension && value !== "") value = Number(value?.toString().replace(input.extension, ""))
        } else {
            const parts = input.id.split(".")
            if (parts.length > 1) value = item[parts[0]]?.[parts[1]]
            else value = item[input.id]
        }
        if (value === undefined) value = input.values.value

        if (input.type === "number") {
            if (value === "") value = undefined
            else value = Number(value)
            if (isNaN(value)) value = undefined
        }
        if (value === undefined) value = defaultValue

        if (input.multiplier) value *= input.multiplier

        // pre 1.5.0 dropdowns
        if (input.type === "fontDropdown") value = value.replaceAll("'", "")

        return value
    }

    function getStyleString(input: EditInput2) {
        let style = ""
        const isItem = input.id === "CSS_item"
        const currentStyle = isItem ? item?.style : input.values?.value
        style = (item.type || "text") === "text" && !isStage ? currentStyle : filterItemStyle(currentStyle, isItem)
        if (!style) return ""

        // sort alphabetically
        let split = style.split(";").filter((a) => a)
        let sorted = split.sort((a, b) => a.localeCompare(b))
        style = sorted.join(";") + ";"

        style = style.replaceAll(";", ";\n").replaceAll(": ", ":").replaceAll(":", ": ").trim()
        return style
    }

    // CHANGE

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
    function changed(e: any, input: any, sectionId = "") {
        let value = e.detail

        if (input.multiplier) value = value / input.multiplier
        if (input.extension) value += input.extension

        if (input.valueIndex !== undefined) {
            if (sections[sectionId]) {
                const allKeyValues = sections[sectionId]?.inputs.flat().filter((a) => a.key === input.key)
                const sortedKeys = allKeyValues.sort((a, b) => a.valueIndex! - b.valueIndex!)

                let currentValue = styles[input.key || ""] || ""
                let arr
                if (input.key === "box-shadow" || input.key === "text-shadow") arr = parseShadowValue(currentValue)
                else arr = currentValue.split(" ").filter(Boolean)
                arr[input.valueIndex] = value

                // add any extensions
                for (let i = 0; i < sortedKeys.length; i++) {
                    if (sortedKeys[i].extension && arr[i] !== undefined && arr[i] !== "") {
                        if (!arr[i].toString().endsWith(sortedKeys[i].extension)) {
                            arr[i] = arr[i].toString().replace(/[^0-9.\-]+$/, "") + sortedKeys[i].extension
                        }
                    }
                }

                value = arr.join(" ")
            } else {
                // reset
                value = ""
            }
        }

        /// CUSTOM

        // reset text shadow if unchanged & setting text color to gradient
        // there is also a different check to remove it if gradient & shadow does not exist (but only in the output)
        if (input.key === "color" && item.lines && sections["shadow"] && !hasChangedValues("shadow") && value.includes("gradient")) {
            toggleSection("shadow")
        }

        if (input.id.includes("CSS")) {
            value = value.replaceAll("\n", "")
            value = (item.type || "text") === "text" && !isStage ? value : mergeWithStyle(value, item.style, input.id === "CSS_item")
        }

        ///

        input.values.value = value
        const inputKey = `${input.id}${input.key || ""}${input.valueIndex || ""}`
        throttle(inputKey, clone(input), (value) => dispatch("change", value), 20)

        input.values.value = e.detail
    }

    function hasChangedValues(id, _updater: any = null) {
        if (!sections[id]) return

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
            return !currentValue?.includes(defaultValue)
        }

        if (input.multiplier) defaultValue *= input.multiplier

        return currentValue === defaultValue
    }

    function resetSection(id: string) {
        sections[id].inputs.forEach((inputRow, rowIndex) => {
            inputRow.forEach((input) => {
                const customDefaultValue = sections[id].defaultValues?.[rowIndex]
                if (isDefaultValue(input, customDefaultValue)) return

                let defaultValue = customDefaultValue ?? input.value

                if (input.type === "toggle") defaultValue = ""
                if (input.type === "radio" && input.value !== defaultValue) return

                if (input.multiplier) defaultValue *= input.multiplier

                // without timeout only last change will take effect as item don't get to update first
                setTimeout(() => changed({ detail: defaultValue }, input))
            })
        })

        if (sections[id].expandAutoValue) setTimeout(() => toggleSection(id))
    }

    let openedSections: string[] = []
    function toggleSection(id: string) {
        const activeIndex = openedSections.indexOf(id)
        if (activeIndex < 0) {
            if (sections[id].expandAutoValue) {
                Object.entries(sections[id].expandAutoValue).forEach(([key, value]) => {
                    const input = clone(sections[id].inputs.flat().find((a) => a.id === key || a.key === key))
                    if (!input) return

                    if (input.valueIndex !== undefined) {
                        delete input.valueIndex
                        delete input.extension
                    }

                    changed({ detail: value }, input, id)
                })
            }

            openedSections.push(id)
        } else {
            openedSections.splice(activeIndex, 1)
        }

        openedSections = openedSections
    }

    $: sectionValues = Object.entries(sections || {})

    ///

    const optionsLists = {
        timers: getSortedTimers($timers, { showHours: item?.timer?.showHours !== false, firstActive: isStage }).map((a) => ({ value: a.id, label: a.name, data: a.extraInfo })),
        actions: sortByName(keysToID($actions)).map((a) => ({ value: a.id, label: a.name || "" }))
    }
    function getOptions(options: string | any[]): any[] {
        if (typeof options === "string") return optionsLists[options] || []
        return options
    }

    function getValues(input: any) {
        const values = clone(input.values)
        if (input.type === "dropdown") {
            if (values.options === "timers") values.addNew = "new.timer"
            values.options = getOptions(values.options)
        }
        return values
    }
</script>

<div class="tools">
    {#each sectionValues as [id, section]}
        {@const hasChanged = section.noReset ? false : hasChangedValues(id, { styles, item })}
        {@const expanded = id === "default" || section.alwaysOpen || openedSections.includes(id)}

        <div class="section" style={expanded ? "margin-bottom: 3px;" : ""}>
            {#if id !== "default"}
                <div class="title">
                    <MaterialButton style="width: 100%;{hasChanged ? 'padding: 4px 12px;' : 'padding: 8px 12px;'}" disabled={hasChanged || section.alwaysOpen} on:click={() => toggleSection(id)}>
                        <span style="display: flex;gap: 8px;align-items: center;">
                            {#if id === "CSS"}
                                <Icon id="code" white />
                                <p>CSS</p>
                            {:else}
                                <Icon {id} style="color: {sectionColors[id]};" white />
                                <p>{translateText(section.name || "edit." + id)}</p>
                            {/if}
                        </span>

                        {#if hasChanged}
                            <MaterialButton title="actions.reset" style="pointer-events: all;padding: 4px;" on:click={() => resetSection(id)}>
                                <Icon id="reset" size={0.8} white />
                            </MaterialButton>
                        {:else if !section.alwaysOpen}
                            <!-- paste / edit -->
                            <Icon id={section.expandAutoValue && !expanded ? "add" : "arrow_back_modern"} class="arrow {expanded ? 'open' : ''}" size={section.expandAutoValue && !expanded ? 0.9 : 0.6} style="opacity: 0.5;" white />
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
                                {@const values = getValues(input)}

                                {#if input.type === "fontDropdown"}
                                    <MaterialFontDropdown
                                        label={values.label}
                                        {value}
                                        style={values.style}
                                        fontStyleValue={input.styleValue}
                                        on:change={(e) => changed(e, input)}
                                        on:fontStyle={(e) => changed(e, { ...input, key: "font" })}
                                        enableFontStyles
                                    />
                                {:else if input.type === "toggle"}
                                    <MaterialButton style="min-width: 50px;flex: 1;" title={values.label} on:click={() => toggle(input)}>
                                        <Icon id={values.icon} size={1.2} white />
                                        <div class="highlight" class:active={value.includes(input.value)}></div>
                                    </MaterialButton>
                                {:else if input.type === "radio"}
                                    <MaterialButton style="min-width: 50px;flex: 1;" title={values.label} on:click={() => radio(input)}>
                                        <Icon id={values.icon} size={1.2} white />
                                        <div class="highlight radio" class:active={value === input.value}></div>
                                    </MaterialButton>
                                {:else if input.type === "textarea"}
                                    <MaterialTextarea label={values.label} {value} on:change={(e) => changed(e, input, id)} />
                                {:else if input.type === "media"}
                                    <MaterialFilePicker
                                        label={(value ? values.label : "") || "edit.choose_media"}
                                        {value}
                                        filter={{ name: "Media files", extensions: mediaExtensions }}
                                        on:change={(e) => changed(e, input, id)}
                                        autoTrigger={$activeEdit.type !== "template"}
                                        allowEmpty
                                    />
                                {:else if input.type === "popup"}
                                    <MaterialPopupButton {...values} {value} on:change={(e) => changed(e, input, id)} allowEmpty />
                                {:else if input.type === "tip"}
                                    <p class="tip">
                                        {#if values.label}{translateText(values.label)}{/if}
                                        {@html input.values?.subtext || ""}
                                        {#if input.values?.subtext.includes("<a href=")}<Icon id="launch" white />{/if}
                                    </p>
                                {:else}
                                    <Input input={{ type: input.type, ...values, value }} on:change={(e) => changed(e, input, id)} />
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
        /* gap: 5px; */
        gap: 2px;
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

    .title :global(svg.arrow) {
        transition: 0.1s transform ease;
        transform: rotate(180deg);
    }
    .title :global(svg.arrow.open) {
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

    /* tip */

    .tip {
        font-size: 0.8em;
        opacity: 0.8;
        padding: 8px;

        text-align: center;
        text-overflow: revert;
        white-space: normal;

        display: flex;
        justify-content: center;
        align-items: center;
        gap: 5px;
        width: 100%;
    }

    /* Link */
    .tip :global(a) {
        color: var(--text);
        opacity: 0.7;
    }
    .tip :global(a):hover {
        opacity: 0.75;
    }
    .tip :global(a):active {
        opacity: 0.9;
    }
</style>
