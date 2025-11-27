<script lang="ts">
    import { activePopup, categories, customizedIcons, mediaFolders, overlayCategories, popupData, selected, templateCategories } from "../../../stores"
    import { customIcons, customIconsColors } from "../../../values/customIcons"
    import { addItem } from "../../edit/scripts/itemHelpers"
    import Icon from "../../helpers/Icon.svelte"
    import HRule from "../../input/HRule.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    const names = {
        category_shows: (icon: string) => categories.update(a => changeIcon(a, icon)),
        category_media: (icon: string) => mediaFolders.update(a => changeIcon(a, icon)),
        category_overlays: (icon: string) => overlayCategories.update(a => changeIcon(a, icon)),
        category_templates: (icon: string) => templateCategories.update(a => changeIcon(a, icon)),
        slide_icon: (icon: string, path: string) => addItem("icon", icon, path ? { path } : { color: customIconsColors[icon] })
    }

    $: colors = $selected.id === "slide_icon"

    const changeIcon = (a: any, icon: string) => {
        $selected.data.forEach(b => {
            if (b !== "all" && b !== "unlabeled") a[b].icon = icon
        })
        return a
    }

    function click(icon: string, path = "") {
        if ($selected.id && names[$selected.id]) names[$selected.id](icon, path)
        else console.log("change icon " + $selected.id)

        activePopup.set(null)
    }

    $: filteredIcons = Object.keys(customIcons).filter(a => !$customizedIcons.disabled.includes(a))

    function manageIcons() {
        popupData.set({ back: "icon" })
        activePopup.set("manage_icons")
    }
</script>

<MaterialButton class="popup-options" icon="edit" iconSize={1.1} title="create_show.more_options" on:click={manageIcons} white />

<div class="grid">
    {#each filteredIcons as icon}
        {@const color = colors && customIconsColors[icon] ? "color: " + customIconsColors[icon] : ""}
        <MaterialButton style="padding: 8px;" on:click={() => click(icon)}>
            <Icon id={icon} size={2} custom white style={color} />
        </MaterialButton>
    {/each}
</div>

{#if $selected.id === "slide_icon" && $customizedIcons.svg.length}
    <HRule />

    <div class="custom grid">
        {#each $customizedIcons.svg as icon}
            <MaterialButton style="padding: 12px;" on:click={() => click(icon.id, icon.path)}>
                {@html icon.path}
            </MaterialButton>
        {/each}
    </div>
{/if}

<style>
    .grid {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        justify-content: center;
    }

    .custom :global(svg) {
        width: 50px;
        height: 50px;
    }
</style>
