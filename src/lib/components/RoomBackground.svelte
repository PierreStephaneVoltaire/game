<script lang="ts">
  import { base } from '$app/paths';

  export let daypart = 'day';
  export let fill = false;
</script>

<div class="room-background-frame" class:fill aria-hidden="true">
  <div class="room-art">
    <img
      class="room-background"
      src={`${base}/assets/room/room-front-bed.svg#${daypart}`}
      alt=""
      width="900"
      height="680"
      draggable="false"
    />
    <div class="cat-bed"></div>
  </div>
</div>

<style>
  .room-background-frame {
    position: absolute;
    inset: 0;
    overflow: hidden;
    container-type: size;
    pointer-events: none;
    background: var(--theme-cream);
  }
  .room-art {
    position: absolute;
    width: 100%;
    aspect-ratio: 900 / 680;
  }
  .room-background {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .cat-bed {
    position: absolute;
    left: 41%;
    top: 67.6471%;
    width: 6.8889%;
    aspect-ratio: 1;
    box-sizing: border-box;
    border: 3px solid var(--theme-room-wood);
    border-radius: 50%;
    background: var(--theme-room-bed);
  }
  .fill {
    background: var(--theme-room-wall);
  }
  .fill .room-art {
    top: 50%;
    left: 50%;
    width: max(calc(100cqw * 900 / 770), calc(100cqh * 900 / 605));
    transform: translate(calc(-100% * 475 / 900), calc(-100% * 347.5 / 680));
  }
</style>
