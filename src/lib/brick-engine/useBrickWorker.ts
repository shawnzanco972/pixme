"use client";
/**
 * React hook wrapping the Brick Engine Web Worker.
 *
 * Usage:
 *   const { brickify, ready } = useBrickWorker();
 *   const { pixelMap } = await brickify(imageData, { cols: 48, rows: 48 });
 *
 * Each call is correlated by an incrementing id so multiple in-flight requests
 * resolve to the right promise. The hook owns the worker lifecycle.
 */
import { useCallback, useEffect, useRef } from "react";

import type { BrickifyOptions, BrickifyResult } from "@/lib/brick-engine";
import type {
  BrickWorkerRequest,
  BrickWorkerResponse,
} from "@/workers/brick.worker";

interface ImageLike {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

type Pending = {
  resolve: (r: BrickifyResult) => void;
  reject: (e: unknown) => void;
};

export function useBrickWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<number, Pending>>(new Map());
  const nextIdRef = useRef(0);

  useEffect(() => {
    const worker = new Worker(
      new URL("../../workers/brick.worker.ts", import.meta.url),
    );

    worker.onmessage = (event: MessageEvent<BrickWorkerResponse>) => {
      const { id, pixelMap, cols, rows } = event.data;
      const pending = pendingRef.current.get(id);
      if (pending) {
        pending.resolve({ pixelMap, cols, rows });
        pendingRef.current.delete(id);
      }
    };

    worker.onerror = (event) => {
      // Fail every in-flight request on a worker error.
      for (const [, p] of pendingRef.current) p.reject(event.message);
      pendingRef.current.clear();
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const brickify = useCallback(
    (image: ImageLike, options?: BrickifyOptions): Promise<BrickifyResult> => {
      const worker = workerRef.current;
      if (!worker) return Promise.reject(new Error("Worker not ready"));

      const id = nextIdRef.current++;
      // Copy the pixels so the caller's source buffer stays usable, then
      // transfer the copy to avoid a structured clone of large images.
      const copy = new Uint8ClampedArray(image.data);
      const request: BrickWorkerRequest = {
        id,
        data: copy,
        width: image.width,
        height: image.height,
        options,
      };

      return new Promise<BrickifyResult>((resolve, reject) => {
        pendingRef.current.set(id, { resolve, reject });
        worker.postMessage(request, [copy.buffer]);
      });
    },
    [],
  );

  return { brickify };
}
