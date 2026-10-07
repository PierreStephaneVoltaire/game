<script lang="ts">
  import { roomLook, roomSvg, roomVariantFor } from '$lib/ui/room-look';
  import { drawRoom } from '$lib/ui/room-canvas';

  export let set: number;
  export let placed: Record<string, string>;

  let host: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let width = 0;

  $: look = { set, placed, picked: $roomLook.variants };

  $: if (host) {
    for (const group of host.querySelectorAll<SVGGElement>('g[data-slot]')) {
      const selected = roomVariantFor(group.dataset.slot!, look);
      group.style.display = group.dataset.variant === selected ? '' : 'none';
    }
  }

  $: if (host && canvas && width && look) {
    void drawRoom(canvas, host.querySelector('svg')!);
  }
</script>

<div class="room-art" bind:clientWidth={width}>
  <div class="room-svg" bind:this={host}>
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html roomSvg}
  </div>
  <canvas class="room-canvas" bind:this={canvas} aria-hidden="true"></canvas>
</div>

<style>
  .room-art {
    position: absolute;
    inset: 0;
  }
  .room-svg,
  .room-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .room-svg {
    visibility: hidden;
  }
  .room-svg :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
  }
  .room-canvas {
    image-rendering: pixelated;
  }
</style>
