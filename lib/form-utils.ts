import type { KeyboardEvent } from "react";

// Prevent Enter (e.g. a barcode scanner's trailing carriage return, or an
// accidental keypress) from submitting a form. Only an explicit button click
// should submit. Enter inside a textarea stays a normal newline.
export function blockEnterSubmit(e: KeyboardEvent<HTMLFormElement>) {
  const target = e.target as HTMLElement;
  if (e.key === "Enter" && target.tagName !== "TEXTAREA") {
    e.preventDefault();
  }
}
