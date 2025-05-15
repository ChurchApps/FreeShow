<script lang="ts">
    import { customMetadata } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import { initializeMetadata } from "../../helpers/show"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

    $: defaultMetadata = Object.keys(initializeMetadata({}))

    let customMetadataValues: string[] = $customMetadata.custom
    let hidden: string[] = $customMetadata.disabled

    function toggleHidden(key: string) {
        if (hidden.includes(key)) hidden.splice(hidden.indexOf(key), 1)
        else hidden.push(key)

        hidden = hidden
        customMetadata.set({ ...$customMetadata, disabled: hidden })
    }

    function updateCustom(name: string, e: any) {
        let value = e.target?.value || ""
        let index = customMetadataValues.findIndex((a) => a === name)
        if (index < 0) return

        customMetadataValues[index] = value
        customMetadata.set({ ...$customMetadata, custom: customMetadataValues })
    }

    function removeCustom(name: string) {
        let index = customMetadataValues.findIndex((a) => a === name)
        if (index < 0) return

        customMetadataValues.splice(index, 1)
        customMetadataValues = customMetadataValues
        customMetadata.set({ ...$customMetadata, custom: customMetadataValues })
    }

    function addCustom() {
        if (emptyEntry) return

        customMetadataValues.push("")
        customMetadataValues = customMetadataValues
        customMetadata.set({ ...$customMetadata, custom: customMetadataValues })
    }

    $: emptyEntry = customMetadataValues.find((a) => a === "") !== undefined
</script>

<!-- <p style="opacity: 0.6;font-size: 0.9em;text-align: center;padding-bottom: 10px;"><T id="tips.global_options" /></p> -->

<div>
    {#each defaultMetadata as key}
        <CombinedInput>
            <p style="width: 100%;{hidden.includes(key) ? 'opacity: 0.5;' : ''}"><T id="meta.{key}" /></p>
            <Button style="min-width: 40px;" on:click={() => toggleHidden(key)} center>
                <Icon id={hidden.includes(key) ? "private" : "eye"} white={hidden.includes(key)} />
            </Button>
        </CombinedInput>
    {/each}
</div>

<div style="margin-top: 10px;">
    {#each customMetadataValues as name}
        <CombinedInput>
            <TextInput value={name} on:change={(e) => updateCustom(name, e)} autofocus={!name} />
            <Button style="min-width: 40px;" on:click={() => removeCustom(name)} center>
                <Icon id="delete" />
            </Button>
        </CombinedInput>
    {/each}

    <CombinedInput>
        <Button style="width: 100%;" on:click={addCustom} disabled={emptyEntry} dark center>
            <Icon id="add" right />
            <T id="settings.add" />
        </Button>
    </CombinedInput>
</div>
