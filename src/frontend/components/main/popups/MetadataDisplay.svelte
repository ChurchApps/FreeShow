<script lang="ts">
    import { onMount } from "svelte"
    import { activePopup, dictionary, popupData, styles } from "../../../stores"
    import { history } from "../../helpers/history"
    import { metadataDisplayValues } from "../../helpers/show"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"

    // VALUES

    const iconSize: number = 100
    const icons = {
        never: '<g><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:1;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:1;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:1;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:1;"/></g>',
        always: '<g><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:1;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:1;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:1;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:1;"/></g><line x1="16.333" y1="42" x2="38.333" y2="42" vector-effect="non-scaling-stroke" stroke-width="2" stroke="#FFFFFF" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/><line x1="61.667" y1="42" x2="83.667" y2="42" vector-effect="non-scaling-stroke" stroke-width="2" stroke="#FFFFFF" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/><line x1="61.667" y1="69" x2="83.667" y2="69" vector-effect="non-scaling-stroke" stroke-width="2" stroke="#FFFFFF" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/><line x1="16.333" y1="69" x2="38.333" y2="69" vector-effect="non-scaling-stroke" stroke-width="2" stroke="#FFFFFF" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/></g>',
        first: '<g><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:1;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:1;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:1;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:1;"/></g><line x1="16.333" y1="42" x2="38.333" y2="42" vector-effect="non-scaling-stroke" stroke-width="2" stroke="#FFFFFF" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/></g>',
        last: '<g><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:1;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:1;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:1;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:1;"/></g><line x1="61.667" y1="69" x2="83.667" y2="69" vector-effect="non-scaling-stroke" stroke-width="2" stroke="#FFFFFF" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/></g>',
        first_last:
            '<g><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 24 L 47.67 24 C 48.222 24 48.67 24.448 48.67 25 L 48.67 47 C 48.67 47.552 48.222 48 47.67 48 L 7 48 C 6.448 48 6 47.552 6 47 L 6 25 C 6 24.448 6.448 24 7 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:1;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 24 L 93 24 C 93.552 24 94 24.448 94 25 L 94 47 C 94 47.552 93.552 48 93 48 L 52.33 48 C 51.778 48 51.33 47.552 51.33 47 L 51.33 25 C 51.33 24.448 51.778 24 52.33 24 Z" style="fill:none;stroke:#FFFFFF;stroke-width:1;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 7 51 L 47.67 51 C 48.222 51 48.67 51.448 48.67 52 L 48.67 74 C 48.67 74.552 48.222 75 47.67 75 L 7 75 C 6.448 75 6 74.552 6 74 L 6 52 C 6 51.448 6.448 51 7 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:1;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="stroke:none;fill:#000000;stroke-miterlimit:10;"/><path d="M 52.33 51 L 93 51 C 93.552 51 94 51.448 94 52 L 94 74 C 94 74.552 93.552 75 93 75 L 52.33 75 C 51.778 75 51.33 74.552 51.33 74 L 51.33 52 C 51.33 51.448 51.778 51 52.33 51 Z" style="fill:none;stroke:#FFFFFF;stroke-width:1;"/></g><line x1="16.333" y1="42" x2="38.333" y2="42" vector-effect="non-scaling-stroke" stroke-width="2" stroke="#FFFFFF" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/><line x1="61.667" y1="69" x2="83.667" y2="69" vector-effect="non-scaling-stroke" stroke-width="2" stroke="#FFFFFF" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/></g>',
    }

    // UPDATE

    function changeMetadata(id: string) {
        if (metadataDisplay === id) {
            activePopup.set(null)
            return
        }

        if (isStyle) {
            if (!$styles[styleId]) setInitialStyle()
            history({ id: "UPDATE", newData: { key: "displayMetadata", data: id }, oldData: { id: styleId }, location: { page: "settings", id: "settings_style", override: "style_" + styleId } })
        } else if (triggerFunction) {
            metadataDisplay = id
            triggerFunction(id)
        }
    }

    function setInitialStyle() {
        // create a style if nothing exists
        styles.update((a) => {
            if (!a[styleId]) a[styleId] = { name: $dictionary.example?.default || "Default" }
            return a
        })
    }

    let isStyle: boolean = $popupData.action === "style_metadata"
    let triggerFunction: any = $popupData.trigger
    let value: string = $popupData.active || ""
    let styleId: string = $popupData.id || "default"

    onMount(() => {
        popupData.set({})
    })

    $: metadataDisplay = (isStyle ? $styles[styleId]?.displayMetadata : value) || "never"
</script>

<div class="types">
    {#each metadataDisplayValues as value}
        {@const isActive = value.id === metadataDisplay}
        <Button outline={isActive} active={isActive} on:click={() => changeMetadata(value.id)} bold={false}>
            <svg viewBox="0 0 100 100" width="{iconSize}pt" height="{iconSize}pt">
                {@html icons[value.id]}
            </svg>
            <T id={value.name} />
        </Button>
    {/each}
</div>

<style>
    .types {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 20px;
        padding: 15px 0;
    }

    .types :global(button) {
        padding: 0.5em 0.8em;
        flex-direction: column;
        gap: 5px;
    }
</style>
