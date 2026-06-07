/// <reference lib="webworker" />
/**
 * Brick Engine Web Worker.
 *
 * Runs the (potentially heavy) image → pixel_map pipeline off the main thread
 * so the UI never blocks while the customer tweaks their mosaic.
 */
import { brickifyImage, type BrickifyOptions } from "@/lib/brick-engine";

export interface BrickWorkerRequest {
  id: number;
  data: Uint8ClampedArray;
  width: number;
  height: number;
  options?: BrickifyOptions;
}

export interface BrickWorkerResponse {
  id: number;
  pixelMap: number[][];
  cols: number;
  rows: number;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<BrickWorkerRequest>) => {
  const { id, data, width, height, options } = event.data;
  const result = brickifyImage({ data, width, height }, options);
  const response: BrickWorkerResponse = { id, ...result };
  ctx.postMessage(response);
};
