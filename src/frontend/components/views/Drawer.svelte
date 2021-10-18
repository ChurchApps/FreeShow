<script lang="ts">
  let height: number = 100
</script>

<section style="height: {height}px">
  <div style="position: relative;">
    test
    <div class="dragger" on:mousedown={() => {}} />
  </div>
</section>

<style>
  section {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 100px;
    z-index: 20;

    background-color: var(--primary);
  }

  .dragger {
    position: absolute;
    top: -5px;
    left: 0;
    width: 100%;
    height: 20px;
    cursor: ns-resize;

    background-color: inherit;
    border-top: 5px solid var(--secondary);
  }
</style>
