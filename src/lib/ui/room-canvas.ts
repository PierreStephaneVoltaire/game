const images = new Map<string, Promise<HTMLImageElement>>();

function loadImage(href: string): Promise<HTMLImageElement> {
  let image = images.get(href);
  if (!image) {
    image = new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = href;
    });
    images.set(href, image);
  }
  return image;
}

export async function composite(room: SVGSVGElement): Promise<ImageData> {
  const { width, height } = room.viewBox.baseVal;
  const source = document.createElement('canvas');
  source.width = width;
  source.height = height;
  const context = source.getContext('2d')!;
  const tiles = [...room.querySelectorAll<SVGGElement>('g[data-slot]')]
    .filter((group) => group.style.display !== 'none')
    .flatMap((group) => [...group.querySelectorAll('svg')]);
  const loaded = await Promise.all(
    tiles.map((tile) => loadImage(tile.querySelector('image')!.href.baseVal)),
  );
  tiles.forEach((tile, index) => {
    const crop = tile.viewBox.baseVal;
    context.drawImage(
      loaded[index],
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      tile.x.baseVal.value,
      tile.y.baseVal.value,
      crop.width,
      crop.height,
    );
  });
  return context.getImageData(0, 0, width, height);
}

export async function drawRoom(
  canvas: HTMLCanvasElement,
  room: SVGSVGElement,
): Promise<void> {
  const pixels = await composite(room);
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  canvas.getContext('2d')!.putImageData(pixels, 0, 0);
}
