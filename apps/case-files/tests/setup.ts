import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { webcrypto } from "node:crypto";

afterEach(cleanup);

// jsdom lacks HTMLDialogElement.showModal/close.
if (typeof HTMLDialogElement !== "undefined") {
  const proto = HTMLDialogElement.prototype;
  if (typeof proto.showModal !== "function") {
    proto.showModal = function showModal(this: HTMLDialogElement): void {
      this.setAttribute("open", "");
    };
  }
  if (typeof proto.close !== "function") {
    proto.close = function close(this: HTMLDialogElement): void {
      this.removeAttribute("open");
    };
  }
}

// jsdom replaces Node's crypto without `subtle`.
if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true, writable: true });
}
