<script lang="ts">
    import { dictionary } from "../../stores"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"

    export let label: string
    export let icon: string
    export let title: string = ""
    export let center: boolean = false
</script>

<h3 class:center data-title={translateText(title)}>
    <Icon id={icon} white />
    {translateText(label, $dictionary)}
</h3>

<style>
    h3 {
        color: var(--text);
        text-transform: uppercase;
        font-size: 0.9em;
        margin-top: 20px;
        margin-bottom: 12px;
        /* margin: 20px 0; */

        display: flex;
        align-items: center;
        /* justify-content: center; */
        gap: 10px;
    }

    .center {
        justify-content: center;
    }
</style>
