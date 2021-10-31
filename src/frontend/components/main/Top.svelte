<script type="ts">
  import TopButton from "../inputs/TopButton.svelte"
</script>

<!-- <button on:click={() => (settings = !settings)}>
  <T id="menus.settings" />
  {translate('menus.settings', $language)}
  {translate(d.menus?.settings)}
</button> -->

<div class="top">
  <span>
    <TopButton id="show" />
    <TopButton id="edit" />
    <TopButton id="reflow" />
    <TopButton id="draw" />
    <TopButton id="stage" />
  </span>
  <span>
    <TopButton id="settings" />
    <!-- Output -->
  </span>
</div>

<style>
  .top {
    position: relative;
    display: flex;
    justify-content: space-between;
    z-index: 30;
    /* box-shadow: 0px 2px 4px rgb(0 0 0 / 30%); */
  }
  .top span {
    display: flex;
  }
</style>
