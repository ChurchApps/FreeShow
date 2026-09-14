<script lang="ts">
    import Title from "../../../components/input/Title.svelte"
    import MaterialDropdown from "../../../components/inputs/MaterialDropdown.svelte"
    import { ai } from "../../../stores"
    import { translateText } from "../../../utils/language"

    $: settings = $ai.scripture || {}

    function updateValue(key: string, value: any) {
        ai.update((a) => {
            if (!a.scripture) a.scripture = {}
            a.scripture[key] = value
            return a
        })
    }

    const confidenceOptions = [
        { value: "ask", label: translateText("ai.confidence_ask") },
        { value: "highest", label: translateText("ai.confidence_highest"), data: "> 95%" },
        { value: "high", label: translateText("ai.confidence_high"), data: "> 75%" },
        { value: "medium", label: translateText("ai.confidence_medium"), data: "> 50%" }
    ]
</script>

<Title label="tabs.scripture" icon="scripture" />

<MaterialDropdown label="Auto present" options={confidenceOptions} value={settings.confidence || "ask"} on:change={(e) => updateValue("confidence", e.detail)} />
