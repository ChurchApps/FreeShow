<script lang="ts">
    import TabletLeft from "./layout/TabletLeft.svelte"
    import TabletCenter from "./layout/TabletCenter.svelte"
    import TabletRight from "./layout/TabletRight.svelte"
    import TabletDrawer from "./layout/TabletDrawer.svelte"
    import Resizeable from "./layout/drawer/Resizeable.svelte"

    // FULLSCREEN
    let isFullscreen: boolean = false
</script>

<div class="column">
    <div class="row">
        {#if !isFullscreen}
            <Resizeable id="leftPanelTablet">
                <div class="left">
                    <TabletLeft />
                </div>
            </Resizeable>
        {/if}

        <div class="center">
            <TabletCenter />
        </div>

        {#if !isFullscreen}
            <Resizeable id="rightPanelTablet" side="right">
                <div class="right">
                    <TabletRight />
                </div>
            </Resizeable>
        {/if}
    </div>
    
    <TabletDrawer />
</div>

<style>
    .column {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        overflow: hidden;
        position: relative;
    }

    .row {
        display: flex;
        flex: 1;
        overflow: hidden;
    }

    .left, .right {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        height: 100%;
    }

    .center {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        min-width: 0;
    }
</style>
