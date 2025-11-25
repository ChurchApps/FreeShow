<script lang="ts">
    // $: categoryId = $drawerTabsData.templates?.activeSubTab || ""

    // const profile = getAccess("templates")
    // $: readOnly = profile.global === "read" || profile[categoryId] === "read"
</script>

<div class="scroll" />

<!-- {#if !readOnly}
    <Button style="width: 100%;" title="This will reset the defaults (shield icon). And pull in any new ones." on:click={setExampleTemplates} center dark>
        <Icon id="reset" right />
        <T id="actions.reset_defaults" />
    </Button>
{/if} -->

<style>
    .scroll {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }
</style>
