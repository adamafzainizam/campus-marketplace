import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { SPARSE_BOARD_MAX, isSparseBoard } from "./browse-board.ts";

describe("isSparseBoard", () => {
  it("is sparse below two full desktop rows", () => {
    assert.equal(isSparseBoard(2, false), true);
    assert.equal(isSparseBoard(7, false), true);
  });

  // Eight is two full rows of four. At that point the grid fills itself and
  // the tile would be pushing into results somebody is reading.
  it("stops at the threshold", () => {
    assert.equal(isSparseBoard(SPARSE_BOARD_MAX, false), false);
    assert.equal(isSparseBoard(60, false), false);
  });

  // An empty row under a filter means "your filter is narrow", not "the site
  // is new" — and answering a failed search with an invitation to post is
  // answering a question nobody asked.
  it("is never sparse while a filter is active", () => {
    assert.equal(isSparseBoard(0, true), false);
    assert.equal(isSparseBoard(2, true), false);
    assert.equal(isSparseBoard(7, true), false);
  });

  it("holds the threshold at eight", () => {
    assert.equal(SPARSE_BOARD_MAX, 8);
  });
});
