<script>
  export let markdown = ""
</script>

<section>
  <!-- svelte-ignore a11y-autofocus -->
  <textarea bind:value={markdown} autofocus />
</section>

<style>
  section {
    width: 100%;
    min-height: 95vh;
    border: 0.1rem solid #333;
    flex: 1.5;
  }

  textarea {
    width: 100%;
    height: 100%;
    min-height: 95vh;
    resize: none;
    margin: 0;
    border: none;
  }
</style>
