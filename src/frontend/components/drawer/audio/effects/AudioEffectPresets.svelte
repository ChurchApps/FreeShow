<script lang="ts">
    import { onDestroy } from "svelte"
    import { uid } from "uid"
    import { DEFAULT_EFFECT_CONFIGS, setEffectConfig, subscribeEffect, type EffectKey, type EffectType } from "../../../../audio/effects/audioEffectsHelpers"
    import { audioEffectPresets } from "../../../../stores"
    import { translateText } from "../../../../utils/language"
    import { clone, keysToID } from "../../../helpers/array"
    import InputRow from "../../../input/InputRow.svelte"
    import MaterialButton from "../../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../../inputs/MaterialDropdown.svelte"
    import MaterialTextInput from "../../../inputs/MaterialTextInput.svelte"

    export let effectKey: EffectType = "equalizer"
    export let channelId: string = "main"
    export let effectId: string = ""

    let selectedPreset = "default"
    let customName = ""
    let currentConfig: any = null
    let isCustom = false

    let unsubscribe: (() => void) | null = null

    function areConfigsEqual(a: any, b: any): boolean {
        if (!a || !b) return false
        const copyA = clone(a)
        const copyB = clone(b)
        delete copyA.enabled
        delete copyB.enabled
        return JSON.stringify(copyA) === JSON.stringify(copyB)
    }

    let presets: Record<string, any> = {}
    $: effectPresets = ($audioEffectPresets?.[effectKey] as Record<string, any>) || {}
    $: defaultPresetConfig = DEFAULT_EFFECT_CONFIGS[effectKey] || {}
    $: presets = {
        ...effectPresets,
        default: {
            name: translateText("example.default"),
            config: defaultPresetConfig
        },
        ...(isCustom && currentConfig
            ? {
                  custom: {
                      name: translateText("sort.custom"),
                      config: currentConfig
                  }
              }
            : {})
    }

    $: presetOptions = keysToID(presets)
        .map((a) => ({ label: a.name, value: a.id }))
        .sort((a, b) => {
            if (a.value === "default" || a.value === "custom") return -1
            if (b.value === "default" || b.value === "custom") return 1
            return a.label.localeCompare(b.label)
        })

    function setDefaultCustomName() {
        const label = translateText("audio.preset")
        const currentPresets = ($audioEffectPresets?.[effectKey] as Record<string, any>) || {}
        const existingWithDefaultName = Object.values(currentPresets)
            .map(({ name }) => {
                const match = name?.match(new RegExp(`^${label} (\\d+)$`))
                return match ? parseInt(match[1], 10) : null
            })
            .filter((num) => num !== null)
        customName = label + " " + (existingWithDefaultName.length + 1).toString()
    }

    function checkPresetMatch(cfg: any) {
        if (!cfg) return

        const currentDefault = DEFAULT_EFFECT_CONFIGS[effectKey] || {}
        const currentPresets = ($audioEffectPresets?.[effectKey] as Record<string, any>) || {}

        if (selectedPreset !== "custom" && selectedPreset !== "default" && currentPresets[selectedPreset]) {
            const currentPreset = currentPresets[selectedPreset]
            if (currentPreset?.config && areConfigsEqual(cfg, currentPreset.config)) {
                isCustom = false
                return
            }
        }

        if (areConfigsEqual(cfg, currentDefault)) {
            selectedPreset = "default"
            isCustom = false
            return
        }

        for (const [id, preset] of Object.entries(currentPresets)) {
            if (preset?.config && areConfigsEqual(cfg, preset.config)) {
                selectedPreset = id
                isCustom = false
                return
            }
        }

        isCustom = true
        selectedPreset = "custom"
        if (!customName) {
            setDefaultCustomName()
        }
    }

    function selectPreset(value: string) {
        selectedPreset = value
        if (value === "custom") {
            isCustom = true
            return
        }
        const currentPresets = ($audioEffectPresets?.[effectKey] as Record<string, any>) || {}
        const currentDefault = DEFAULT_EFFECT_CONFIGS[effectKey] || {}
        const preset = value === "default" ? { config: currentDefault } : currentPresets[value]
        if (!preset?.config) return

        isCustom = false
        setEffectConfig(effectKey as EffectKey, clone(preset.config), channelId, effectId)
    }

    function saveCustomPreset() {
        const name = customName.trim()
        if (!name || !currentConfig) return

        const id = uid(5)
        audioEffectPresets.update((all) => {
            const effects = all[effectKey] ? { ...all[effectKey] } : {}
            effects[id] = {
                name,
                config: clone(currentConfig)
            }
            return {
                ...all,
                [effectKey]: effects
            }
        })

        isCustom = false
        selectedPreset = id
        setDefaultCustomName()
    }

    function deletePreset() {
        if (selectedPreset === "default" || selectedPreset === "custom") return

        audioEffectPresets.update((all) => {
            const effects = all[effectKey] ? { ...all[effectKey] } : {}
            delete effects[selectedPreset]
            return {
                ...all,
                [effectKey]: effects
            }
        })

        selectPreset("default")
    }

    $: {
        unsubscribe?.()
        selectedPreset = "default"
        isCustom = false
        customName = ""
        unsubscribe = subscribeEffect(
            effectKey,
            (cfg) => {
                currentConfig = clone(cfg)
                checkPresetMatch(cfg)
            },
            channelId,
            effectId
        )
    }

    onDestroy(() => {
        unsubscribe?.()
    })
</script>

<InputRow>
    <MaterialDropdown label="audio.preset" value={selectedPreset} options={presetOptions} defaultValue="default" on:change={(e) => selectPreset(e.detail)} />

    {#if selectedPreset === "custom"}
        <MaterialTextInput label="inputs.name" value={customName} on:change={(e) => (customName = e.detail)} />
        <MaterialButton icon="save" title="actions.save" on:click={saveCustomPreset} />
    {:else if selectedPreset !== "default"}
        <MaterialButton icon="delete" title="actions.delete" on:click={deletePreset} white />
    {/if}
</InputRow>
