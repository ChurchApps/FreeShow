<script lang="ts">
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"

    export let label: string
    export let icon: string
    export let center: boolean = false
</script>

<h3 class:center>
    <Icon id={icon} white />
    <T id={label} />
</h3>

<style>
    h3 {
        color: var(--text);
        text-transform: uppercase;
        font-size: 0.9em;
        margin: 20px 0;

        display: flex;
        align-items: center;
        gap: 10px;
    }

    .center {
        justify-content: center;
    }
</style>
