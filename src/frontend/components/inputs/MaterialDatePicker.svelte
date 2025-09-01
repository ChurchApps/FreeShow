<script lang="ts">
    import MaterialTimePicker from "./MaterialTimePicker.svelte"

    export let label: string
    export let value: string // expected format: "YYYY-MM-DD"
    export let defaultValue: string | null = null

    export let id = ""
    export let title = ""

    export let disabled = false
    export let autofocus = false
</script>

<MaterialTimePicker {label} {value} {defaultValue} {id} {title} {disabled} {autofocus} style={$$props.style} isDate />
