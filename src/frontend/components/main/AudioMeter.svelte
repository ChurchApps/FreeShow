<script>
  let l = 0
  let r = 0

  // setInterval(() => {
  //   if (Math.floor(Math.random() * 10) === 0) {
  //     l = Math.floor(Math.random() * 101) // 0 - 100
  //     r = Math.floor(Math.random() * 101) // 0 - 100
  //   } else {
  //     l = Math.floor(Math.random() * 25) + 60 // 60-85
  //     r = Math.floor(Math.random() * 25) + 60 // 60-85
  //   }
  // }, 100)
</script>

<div class="main">
  <span class="left">
    <!-- <p>L</p> -->
    <div style="height: {100 - l}%" />
  </span>
  <span class="right">
    <!-- <p>R</p> -->
    <div style="height: {100 - r}%" />
  </span>
</div>

<style>
  .main {
    width: 15px;
    display: flex;
    border-left: 5px solid var(--primary-lighter);
  }

  span {
    background-image: linear-gradient(rgb(200, 0, 0) 1%, rgb(255, 220, 0) 16%, rgb(0, 220, 0) 45%, rgb(0, 120, 0) 100%);
    filter: hue-rotate(250deg);
    width: 50%;
  }

  span div {
    transition: height 0.2s ease 0s;
    background-color: var(--primary);
    width: 100%;
  }
</style>
