<script lang="ts">
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import { markTipString } from "./tipWordDictionary"

    export let value: string
    export let style: string = ""
    export let top: number = 0
    export let bottom: number = 0

    const translatedValue = translateText(value)
    const markedValue = markTipString(translatedValue)
</script>

<div class="tip" style="{style}margin-top: {top}px;margin-bottom: {bottom}px;">
    <Icon id="tip" size={1.2} gradient />
    <p>{@html markedValue}</p>
</div>

<style>
    .tip {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }

    .tip p {
        font-size: 0.75em;
        white-space: initial;

        opacity: 0.7;
    }

    .tip :global(.tip-word) {
        text-decoration: underline;
        text-decoration-style: dotted;
        cursor: help;
    }
</style>
