<script lang="ts">
    import { getQuickExample } from "../../converters/txt"
    import { slidesOptions } from "../../stores"
    import { formatText } from "./formatTextEditor"
    import { getPlainEditorText } from "./getTextEditor"
    import Notes from "./tools/Notes.svelte"

    export let currentShow: any

    let text: string = ""
    $: if (currentShow) text = getPlainEditorText()
</script>

<Notes disabled={currentShow?.locked} style="padding: 30px;font-size: {(-1.1 * $slidesOptions.columns + 12) / 6}em;" placeholder={getQuickExample()} value={text} on:change={(e) => formatText(e.detail)} />
