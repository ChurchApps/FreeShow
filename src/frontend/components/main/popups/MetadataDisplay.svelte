<script lang="ts">
    import type { Metadata } from "../../../../types/Settings"
    import { activeEdit, activePage, activePopup, categories, currentMetadataPopupData, popupData, styles, templates } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { clone } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import { metadataDisplayValues } from "../../helpers/show"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialPopupButton from "../../inputs/MaterialPopupButton.svelte"
    import Tip from "../Tip.svelte"

    let data
    if ($popupData.type === "show_category" || $popupData.type === "style") {
        data = clone($popupData)
        currentMetadataPopupData.set(data)
    } else {
        data = $currentMetadataPopupData
    }

    const type = data.type
    const ids = data.id ? [data.id] : data.ids || []

    // get values
    let currentValue: Metadata = {}
    if (type === "show_category") {
        currentValue = $categories[ids[0]]?.metadata || {}
    } else if (type === "style") {
        currentValue = $styles[ids[0]]?.metadata || {}
    }

    $: display = currentValue.display || (type === "style" ? "default" : "never")
    $: templateAll = currentValue.templateAll || "metadata"
    $: template = currentValue.template || (display === "always" ? templateAll : "metadata")
    $: templateFirst = currentValue.templateFirst || (display === "always" ? templateAll : template)

    // VALUES

    const iconSize = 95
    const icons = {
        never: '<g><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/></g>',
        always: '<g><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/></g><line x1="16.333" y1="42" x2="38.333" y2="42" vector-effect="non-scaling-stroke" stroke-width="2" stroke="#FFFFFF" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/><line x1="61.667" y1="42" x2="83.667" y2="42" vector-effect="non-scaling-stroke" stroke-width="2" stroke="#FFFFFF" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/><line x1="61.667" y1="69" x2="83.667" y2="69" vector-effect="non-scaling-stroke" stroke-width="2" stroke="#FFFFFF" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/><line x1="16.333" y1="69" x2="38.333" y2="69" vector-effect="non-scaling-stroke" stroke-width="2" stroke="#FFFFFF" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/></g>',
        first: '<g><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/></g><line x1="16.333" y1="42" x2="38.333" y2="42" vector-effect="non-scaling-stroke" stroke-width="2" stroke="#FFFFFF" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/></g>',
        last: '<g><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/></g><line x1="61.667" y1="69" x2="83.667" y2="69" vector-effect="non-scaling-stroke" stroke-width="2" stroke="#FFFFFF" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/></g>',
        first_last:
            '<g><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:0.3;"/></g><line x1="16.333" y1="42" x2="38.333" y2="42" vector-effect="non-scaling-stroke" stroke-width="2" stroke="#FFFFFF" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/><line x1="61.667" y1="69" x2="83.667" y2="69" vector-effect="non-scaling-stroke" stroke-width="2" stroke="#FFFFFF" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/></g>'
    }

    // UPDATE

    function changeMetadata(key: string, value: string) {
        console.log(key, value)

        if (key === "display" && currentValue[key] === value) {
            activePopup.set(null)
            return
        }

        if (key === "template" && value === "metadata") {
            changeMetadata("templateFirst", value)
        }
        if (display === "always" && (key === "template" || key === "templateFirst") && value === templateAll) {
            value = ""
        }

        currentValue[key] = value

        if (type === "show_category") {
            categories.update((a) => {
                ids.forEach((id) => {
                    if (!a[id]) return

                    if (key === "display" && value === "never") {
                        delete a[id].metadata
                        return
                    }

                    if (!a[id].metadata) a[id].metadata = {}
                    a[id].metadata[key] = value
                })
                return a
            })
            return
        }

        if (type === "style") {
            styles.update((a) => {
                const id = ids[0] || "default"
                if (!a[id]) a[id] = { name: translateText("example.default") }

                if (key === "display" && value === "default") {
                    delete a[id].metadata
                    return a
                }

                if (!a[id].metadata) a[id].metadata = {}
                a[id].metadata[key] = value

                return a
            })
        }

        if (data.trigger) {
            value = value
            data.trigger(value)
            return
        }
    }

    function editTemplate(id: string) {
        // activeDrawerTab.set("templates")
        activeEdit.set({ type: "template", id, items: [] })
        activePage.set("edit")
        activePopup.set(null)
    }

    $: displayValues = type === "style" ? [{ id: "default", name: "example.default" }, ...metadataDisplayValues] : metadataDisplayValues
</script>

<div class="types">
    {#each displayValues as data}
        {@const isActive = data.id === display}
        <MaterialButton style="background-color: var(--primary-darker);" showOutline={isActive} {isActive} on:click={() => changeMetadata("display", data.id)}>
            {#if data.id === "default"}
                <Icon id="shows" style="height: {iconSize}pt;opacity: 0.8;" size={2} white />
            {:else}
                <svg viewBox="0 0 100 100" width="{iconSize}pt" height="{iconSize}pt">
                    {@html icons[data.id]}
                </svg>
            {/if}

            <p style="font-size: 0.75em;opacity: 0.9;">{translateText(data.name)}</p>
        </MaterialButton>
    {/each}
</div>

{#if display === "default"}
    <Tip value="tips.display_metadata" top={20} />
{:else if display !== "never"}
    <div style="margin-top: 20px;">
        {#if display === "always"}
            <InputRow>
                <MaterialPopupButton label="meta.meta_template" value={templateAll} defaultValue="metadata" name={$templates[templateAll]?.name} popupId="select_template" icon="templates" data={{ revert: "metadata_display" }} on:change={(e) => changeMetadata("templateAll", e.detail)} />
                {#if templateAll && $templates[templateAll]}
                    <MaterialButton title="titlebar.edit" icon="edit" on:click={() => editTemplate(templateAll)} />
                {/if}
            </InputRow>
        {/if}

        {#if display === "first_last" || display === "always"}
            <InputRow>
                <MaterialPopupButton label="meta.meta_template (show_at.first)" value={templateFirst} defaultValue={display === "always" ? templateAll : template} name={$templates[templateFirst]?.name} popupId="select_template" icon="templates" data={{ revert: "metadata_display" }} on:change={(e) => changeMetadata("templateFirst", e.detail)} />
                {#if templateFirst && $templates[templateFirst]}
                    <MaterialButton title="titlebar.edit" icon="edit" on:click={() => editTemplate(templateFirst)} />
                {/if}
            </InputRow>
        {/if}

        <InputRow>
            <MaterialPopupButton label="meta.meta_template{display === 'first_last' || display === 'always' ? ' (show_at.last)' : ''}" value={template} defaultValue={display === "always" ? templateAll : "metadata"} name={$templates[template]?.name} popupId="select_template" icon="templates" data={{ revert: "metadata_display" }} on:change={(e) => changeMetadata("template", e.detail)} />
            {#if template && $templates[template]}
                <MaterialButton title="titlebar.edit" icon="edit" on:click={() => editTemplate(template)} />
            {/if}
        </InputRow>

        <Tip value="tips.metadata_customize" top={20} />
    </div>
{/if}

<style>
    .types {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 5px;
    }

    .types :global(button) {
        font-weight: normal;
        border: 2px solid var(--primary-lighter) !important;

        padding: 0.6em;
        flex-direction: column;
        gap: 5px;

        /* min-width: 200px; */
    }
</style>
