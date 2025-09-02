<script lang="ts">
    import { uid } from "uid"
    import type { Popups } from "../../../../types/Main"
    import { activePopup, customizedIcons, dictionary, popupData } from "../../../stores"
    import { customIcons, customIconsColors } from "../../../values/customIcons"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    let colors = true

    function click(icon: string) {
        let isDefault = customIcons[icon]

        customizedIcons.update((a) => {
            if (isDefault) {
                let disabledIcons = a.disabled
                let iconIndex = disabledIcons.indexOf(icon)
                if (iconIndex >= 0) disabledIcons.splice(iconIndex, 1)
                else disabledIcons.push(icon)
                a.disabled = disabledIcons
            }

            return a
        })
    }

    async function importSVG() {
        const text = await navigator.clipboard.readText()
        if (!text || !text.includes("<svg")) return

        customizedIcons.update((a) => {
            a.svg.push({ id: uid(), path: text })
            return a
        })
    }

    function deleteCustom(iconId: string) {
        customizedIcons.update((a) => {
            let iconIndex = a.svg.findIndex((a) => a.id === iconId)
            if (iconIndex >= 0) a.svg.splice(iconIndex, 1)

            return a
        })
    }

    let back: Popups | null = $popupData.back || null
    popupData.set({})
</script>

{#if back}
    <MaterialButton class="popup-back" icon="back" iconSize={1.3} title="actions.back" on:click={() => activePopup.set(back)} />
{/if}

<div class="info">
    <p><T id="actions.click_disable" /></p>
</div>

<div class="grid">
    {#each Object.keys(customIcons) as icon}
        {@const color = colors && customIconsColors[icon] ? "color: " + customIconsColors[icon] + ";" : ""}
        {@const disabled = $customizedIcons.disabled.includes(icon)}
        <MaterialButton style="padding: 8px;" on:click={() => click(icon)} title={disabled ? $dictionary.actions?.enable : $dictionary.actions?.disable}>
            <Icon id={icon} size={2} custom white style={disabled ? "opacity: 0.2;" : color} />
        </MaterialButton>
    {/each}

    <MaterialButton variant="outlined" style="width: 100%;margin: 10px 0;" on:click={importSVG} center dark>
        <Icon id="copy" size={1.2} />
        <T id="actions.svg_clipboard" />
    </MaterialButton>

    {#if $customizedIcons.svg.length}
        <div class="custom grid">
            {#each $customizedIcons.svg as icon}
                <MaterialButton style="padding: 12px;" on:click={() => deleteCustom(icon.id)} title={$dictionary.actions?.delete}>
                    {@html icon.path}
                </MaterialButton>
            {/each}
        </div>
    {/if}
</div>

<style>
    .info {
        display: flex;
        justify-content: center;

        margin-bottom: 10px;
        font-style: italic;
        opacity: 0.7;
        font-size: 0.9em;
    }

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

    .custom :global(button):hover {
        background-color: rgb(255 0 0 / 0.25) !important;
    }
</style>
