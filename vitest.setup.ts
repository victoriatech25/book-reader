// toBeInTheDocument 등 DOM 단정을 Vitest의 expect에 등록한다.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
