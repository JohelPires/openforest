import { Blob as NodeBlob } from "node:buffer";

import "@testing-library/jest-dom/vitest";

if (typeof globalThis.Blob?.prototype.stream !== "function") {
  globalThis.Blob = NodeBlob as unknown as typeof globalThis.Blob;
}
