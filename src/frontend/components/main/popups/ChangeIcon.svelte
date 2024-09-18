<script lang="ts">
    import { activePopup, categories, customizedIcons, mediaFolders, overlayCategories, selected, templateCategories } from "../../../stores"
    import { addItem } from "../../edit/scripts/itemHelpers"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import { customIcons, customIconsColors } from "../../../values/customIcons"

    const names: any = {
        category_shows: (icon: string) => categories.update((a) => changeIcon(a, icon)),
        category_media: (icon: string) => mediaFolders.update((a) => changeIcon(a, icon)),
        category_overlays: (icon: string) => overlayCategories.update((a) => changeIcon(a, icon)),
        category_templates: (icon: string) => templateCategories.update((a) => changeIcon(a, icon)),
        slide_icon: (icon: string, path: string) => addItem("icon", icon, path ? { path } : { color: customIconsColors[icon] }),
    }

    $: colors = $selected.id === "slide_icon"

    const changeIcon = (a: any, icon: string) => {
        $selected.data.forEach((b) => {
            if (b !== "all" && b !== "unlabeled") a[b].icon = icon
        })
        return a
    }

    function click(icon: string, path: string = "") {
        if ($selected.id && names[$selected.id]) names[$selected.id](icon, path)
        else console.log("change icon " + $selected.id)

        activePopup.set(null)
    }

    $: filteredIcons = Object.keys(customIcons).filter((a) => !$customizedIcons.disabled.includes(a))
</script>

<div class="grid">
    {#each filteredIcons as icon}
        {@const color = colors && customIconsColors[icon] ? "color: " + customIconsColors[icon] : ""}
        <Button on:click={() => click(icon)}>
            <Icon id={icon} size={2} custom white style={color} />
        </Button>
    {/each}
</div>

{#if $selected.id === "slide_icon"}
    <br />

    <div class="custom grid">
        {#each $customizedIcons.svg as icon}
            <Button on:click={() => click(icon.id, icon.path)}>
                {@html icon.path}
            </Button>
        {/each}
    </div>

    <Button style="width: 100%;margin-top: 10px;" on:click={() => activePopup.set("manage_icons")} dark center>
        <Icon id="edit" style="border: 0;" right />
        <p style="padding: 0;"><T id="popup.manage_icons" /></p>
    </Button>
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
