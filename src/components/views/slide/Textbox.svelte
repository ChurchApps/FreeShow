<script>
  export let textbox;
</script>

<div class="textbox" style={textbox.style}>
  {#each textbox.content as text}
    <p style={text.style}>{text.text}</p>
  {/each}
</div>

<style>
  .textbox {
    border: 1px dashed var(--secondary-opacity); /* DEBUG */

    position: absolute;
    /* display: inline-flex; */
  }

  p {
    display: inline;
    color: white;
  }
</style>