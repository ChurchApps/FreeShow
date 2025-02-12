<script lang="ts">
    import { onMount } from "svelte"
    import { activePopup, dictionary, popupData, styles } from "../../../stores"
    import { mediaFitOptions } from "../../edit/values/boxes"
    import { history } from "../../helpers/history"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"

    // VALUES

    const iconSize: number = 100
    const icons = {
        contain:
            '<g><path d="M 22 20.5 L 78 20.5 C 79.104 20.5 80 21.396 80 22.5 L 80 78.5 C 80 79.604 79.104 80.5 78 80.5 L 22 80.5 C 20.896 80.5 20 79.604 20 78.5 L 20 22.5 C 20 21.396 20.896 20.5 22 20.5 Z" style="fill:none;stroke:#FFFFFF;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><g><g><rect x="20" y="20.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="35" y="35.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="50" y="50.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="65" y="65.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="65" y="35.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="35" y="65.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="20" y="50.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="50" y="20.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/></g></g><path d="M 7 20.5 L 93 20.5 C 94.104 20.5 95 21.396 95 22.5 L 95 78.5 C 95 79.604 94.104 80.5 93 80.5 L 7 80.5 C 5.896 80.5 5 79.604 5 78.5 L 5 22.5 C 5 21.396 5.896 20.5 7 20.5 Z" style="fill:none;stroke:#000000;stroke-width:4;stroke-linecap:square;stroke-miterlimit:2;"/></g>',
        cover: '<g><path d="M 7 5.5 L 93 5.5 C 94.104 5.5 95 6.396 95 7.5 L 95 93.5 C 95 94.604 94.104 95.5 93 95.5 L 7 95.5 C 5.896 95.5 5 94.604 5 93.5 L 5 7.5 C 5 6.396 5.896 5.5 7 5.5 Z" style="fill:none;stroke:#FFFFFF;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><g><g><rect x="5" y="5.5" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="27.5" y="28" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="50" y="50.5" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="72.5" y="73" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="72.5" y="28" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="27.5" y="73" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="5" y="50.5" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="50" y="5.5" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/></g></g><path d="M 7 20.5 L 93 20.5 C 94.104 20.5 95 21.396 95 22.5 L 95 78.5 C 95 79.604 94.104 80.5 93 80.5 L 7 80.5 C 5.896 80.5 5 79.604 5 78.5 L 5 22.5 C 5 21.396 5.896 20.5 7 20.5 Z" style="fill:none;stroke:#000000;stroke-width:4;stroke-linecap:square;stroke-miterlimit:2;"/></g>',
        fill: '<g><path d="M 6.8 20.5 L 93.2 20.5 C 94.193 20.5 95 21.307 95 22.3 L 95 78.7 C 95 79.693 94.193 80.5 93.2 80.5 L 6.8 80.5 C 5.807 80.5 5 79.693 5 78.7 L 5 22.3 C 5 21.307 5.807 20.5 6.8 20.5 Z" style="fill:none;stroke:#FFFFFF;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><g><g><rect x="5" y="20.5" width="22.5" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="27.5" y="35.5" width="22.5" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="50" y="50.5" width="22.5" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="72.5" y="65.5" width="22.5" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="72.5" y="35.5" width="22.5" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="27.5" y="65.5" width="22.5" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="5" y="50.5" width="22.5" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="50" y="20.5" width="22.5" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/></g></g><path d="M 7 20.5 L 93 20.5 C 94.104 20.5 95 21.396 95 22.5 L 95 78.5 C 95 79.604 94.104 80.5 93 80.5 L 7 80.5 C 5.896 80.5 5 79.604 5 78.5 L 5 22.5 C 5 21.396 5.896 20.5 7 20.5 Z" style="fill:none;stroke:#000000;stroke-width:4;stroke-linecap:square;stroke-miterlimit:2;"/></g>',
        blur: '<g><g style="filter: blur(2px) opacity(0.3);"><path d="M 7 5.5 L 93 5.5 C 94.104 5.5 95 6.396 95 7.5 L 95 93.5 C 95 94.604 94.104 95.5 93 95.5 L 7 95.5 C 5.896 95.5 5 94.604 5 93.5 L 5 7.5 C 5 6.396 5.896 5.5 7 5.5 Z" style="fill:none;stroke:#FFFFFF;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><g><g><rect x="5" y="5.5" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="27.5" y="28" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="50" y="50.5" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="72.5" y="73" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="72.5" y="28" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="27.5" y="73" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="5" y="50.5" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="50" y="5.5" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/></g></g></g>  <path d="M 22 20.5 L 78 20.5 C 79.104 20.5 80 21.396 80 22.5 L 80 78.5 C 80 79.604 79.104 80.5 78 80.5 L 22 80.5 C 20.896 80.5 20 79.604 20 78.5 L 20 22.5 C 20 21.396 20.896 20.5 22 20.5 Z" style="fill:none;stroke:#FFFFFF;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><g><g><rect x="20" y="20.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="35" y="35.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="50" y="50.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="65" y="65.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="65" y="35.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="35" y="65.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="20" y="50.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="50" y="20.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/></g></g><path d="M 7 20.5 L 93 20.5 C 94.104 20.5 95 21.396 95 22.5 L 95 78.5 C 95 79.604 94.104 80.5 93 80.5 L 7 80.5 C 5.896 80.5 5 79.604 5 78.5 L 5 22.5 C 5 21.396 5.896 20.5 7 20.5 Z" style="fill:none;stroke:#000000;stroke-width:4;stroke-linecap:square;stroke-miterlimit:2;"/></g>',
    }

    // UPDATE

    function changeFit(id: string) {
        if (isStyle) {
            if (styleFit === id) {
                activePopup.set(null)
                return
            }
            if (!$styles[styleId]) setInitialStyle()

            history({ id: "UPDATE", newData: { key: "fit", data: id }, oldData: { id: styleId }, location: { page: "settings", id: "settings_style", override: "style_" + styleId } })
        }
    }

    function setInitialStyle() {
        // create a style if nothing exists
        styles.update((a) => {
            if (!a[styleId]) a[styleId] = { name: $dictionary.example?.default || "Default" }
            return a
        })
    }

    // let isItem: boolean = $popupData.id === "fit"
    let isStyle: boolean = $popupData.action === "style_fit"
    let styleId: string = $popupData.id || "default"

    onMount(() => {
        popupData.set({})
    })

    // STYLE FIT

    $: styleFit = $styles[styleId]?.fit || "contain"
</script>

<div class="types">
    {#each mediaFitOptions as fit}
        {@const isActive = fit.id === styleFit}
        <Button outline={isActive} active={isActive} on:click={() => changeFit(fit.id)} bold={false}>
            <svg viewBox="0 0 100 100" width="{iconSize}pt" height="{iconSize}pt">
                {@html icons[fit.id]}
            </svg>
            <T id={fit.name} />
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
