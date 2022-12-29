<script lang="ts">
  export let autoSize: number = 0

  let d = new Date()
  setInterval(() => (d = new Date()), 200)
  $: h = ("0" + d.getHours()).slice(-2)
  $: m = ("0" + d.getMinutes()).slice(-2)
  $: s = ("0" + d.getSeconds()).slice(-2)
</script>

<div style={autoSize ? `font-size: ${autoSize}px;height: 100%;align-items: center;` : ""}>
  <span class="colored">{h}</span>:
  <span class="colored">{m}</span>
  <span class="smaller">:{s}</span>
</div>

<style>
  div {
    display: flex;
    justify-content: center;
    align-items: baseline;
    font-size: 4em;
  }

  .smaller {
    font-size: 0.5em;
  }

  .colored {
    color: var(--secondary);
  }
</style>
