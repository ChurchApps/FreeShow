<script lang="ts">
    import { Main } from "../../../../types/IPC/Main"
    import type { Option } from "../../../../types/Main"
    import { TranslationMethod } from "../../../../types/Songbeamer"
    import { sendMain } from "../../../IPC/main"
    import { activePopup, categories } from "../../../stores"
    import { translate } from "../../../utils/language"
    import { sortObject } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"

    const encodingOptions = [
        {
            id: "utf8",
            name: translate("songbeamer_import.utf8"),
        },
        {
            id: "latin1",
            name: translate("songbeamer_import.latin1"),
            extra: translate("songbeamer_import.older_versions"),
        },
    ]
    let selectedEncoding: Option = encodingOptions[0]

    const songbeamerCatId: string = "songbeamer"
    let cats: any = [
        ...sortObject(
            Object.keys($categories).map((key: string) => ({
                id: key,
                ...$categories[key],
            })),
            "name"
        ).map(
            (cat: any): Option => ({
                id: cat.id,
                name: cat.default ? `$:${cat.name}:$` : cat.name,
            })
        ),
    ]
    let selectedCategory: Option = cats.find((el: Option) => el.id === songbeamerCatId)
    if (!selectedCategory) {
        selectedCategory = {
            id: songbeamerCatId,
            name: "Songbeamer",
        }
        cats.unshift(selectedCategory)
    }

    let selectedTranslationMethod = TranslationMethod.MultiLine

    function importListener() {
        sendMain(Main.IMPORT, {
            channel: "songbeamer",
            format: { name: "Songbeamer", extensions: ["sng"] },
            settings: { encoding: selectedEncoding, category: selectedCategory, translation: selectedTranslationMethod },
        })
        $activePopup = null
    }
</script>

<h4><T id="songbeamer_import.options" /></h4>

<CombinedInput textWidth={30}>
    <p><T id="songbeamer_import.encoding" /></p>
    <Dropdown value={selectedEncoding?.name} options={encodingOptions} on:click={(evt) => (selectedEncoding = evt.detail)} />
</CombinedInput>

<CombinedInput textWidth={30}>
    <p><T id="show.category" /></p>
    <Dropdown options={cats} value={selectedCategory?.name} on:click={(evt) => (selectedCategory = evt.detail)} />
</CombinedInput>

<h4><T id="songbeamer_import.translations" /></h4>

<div class="translation-method">
    {#each Object.values(TranslationMethod) as method}
        <Button center dark active={method === selectedTranslationMethod} on:click={() => (selectedTranslationMethod = method)}>
            <T id="songbeamer_import.translation_{method}" />
        </Button>
    {/each}
</div>

<p class="translation-description">
    <T id="songbeamer_import.translation_description_{selectedTranslationMethod}" />
</p>

<hr />

<div class="import-button">
    <Button center dark on:click={importListener}>
        <Icon id="import" size={1.2} right />
        <T id="actions.import" />
    </Button>
</div>

<style>
    h4 {
        color: var(--text);
        margin: 20px 0;
        text-align: center;
    }
    h4:first-child {
        margin-top: 0;
    }
    h4:last-child {
        margin-bottom: 0;
    }

    .translation-method {
        display: flex;
        flex-flow: wrap;
    }
    .translation-method :global(button) {
        flex: 1;
        border-bottom: 2px solid var(--primary-lighter);
    }
    .translation-method :global(button.active) {
        border-bottom: 2px solid var(--secondary) !important;
    }

    hr {
        border: none;
        height: 2px;
        margin: 20px 0;
        background-color: var(--primary-lighter);
    }

    .translation-description {
        margin: 10px 0;
        white-space: normal;
    }

    .import-button > :global(button) {
        width: 100%;
    }
</style>
