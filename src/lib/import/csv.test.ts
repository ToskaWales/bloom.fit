// Pins down the CSV reader on the quirks of real exports (quotes, BOM, CRLF,
// semicolons from German Excel). A wrong parse here silently corrupts imported training history.
import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("parses quoted fields, escaped quotes, commas and newlines inside quotes", () => {
    const text = 'a,b,c\n"x, y","say ""hi""","line1\nline2"\n1,2,3\n';
    expect(parseCsv(text)).toEqual([
      { a: "x, y", b: 'say "hi"', c: "line1\nline2" },
      { a: "1", b: "2", c: "3" },
    ]);
  });
  it("handles BOM, CRLF and a missing final newline", () => {
    expect(parseCsv("﻿a,b\r\n1,2")).toEqual([{ a: "1", b: "2" }]);
  });
  it("detects semicolon delimiters (German Excel exports)", () => {
    expect(parseCsv("a;b\n1;2\n")).toEqual([{ a: "1", b: "2" }]);
  });
  it("ignores blank lines and pads short rows", () => {
    expect(parseCsv("a,b,c\n\n1,2\n")).toEqual([{ a: "1", b: "2", c: "" }]);
  });
  it("returns nothing for empty input", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("a,b\n")).toEqual([]);
  });

  it("treats a quote inside an unquoted field literally instead of swallowing the file", () => {
    expect(parseCsv('a,b\n5" bar,2\nnext,3\n')).toEqual([
      { a: '5" bar', b: "2" },
      { a: "next", b: "3" },
    ]);
  });
});
