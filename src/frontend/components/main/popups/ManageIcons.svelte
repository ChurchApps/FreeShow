<script lang="ts">
    import { uid } from "uid"
    import { customizedIcons, dictionary } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import { customIcons, customIconsColors } from "../customIcons"

    let colors: boolean = true

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
</script>

<div class="info">
    <p><T id="actions.click_disable" /></p>
</div>

<div class="grid">
    {#each Object.keys(customIcons) as icon}
        {@const color = colors && customIconsColors[icon] ? "color: " + customIconsColors[icon] + ";" : ""}
        {@const disabled = $customizedIcons.disabled.includes(icon)}
        <Button on:click={() => click(icon)} title={disabled ? $dictionary.actions?.enable : $dictionary.actions?.disable}>
            <Icon id={icon} size={2} custom white style={disabled ? "opacity: 0.2;" : color} />
        </Button>
    {/each}

    <Button style="width: 100%;margin: 10px 0;" on:click={importSVG} center dark>
        <Icon id="copy" size={1.2} right />
        <T id="actions.svg_clipboard" />
    </Button>

    {#if $customizedIcons.svg.length}
        <div class="custom grid">
            {#each $customizedIcons.svg as icon}
                <Button on:click={() => deleteCustom(icon.id)} title={$dictionary.actions?.delete}>
                    {@html icon.path}
                </Button>
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
        opacity: 0.8;
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
