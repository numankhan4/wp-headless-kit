import { test } from "node:test";
import assert from "node:assert/strict";
import { WPClient, buildMenuTree } from "../src/index.js";
import type { WPMenuItem } from "../src/index.js";

function item(id: number, parent: number, menu_order: number): WPMenuItem {
  return { id, parent, menu_order, url: `/${id}`, title: { rendered: `Item ${id}` } };
}

test("buildMenuTree nests by parent and sorts by menu_order", () => {
  const input = [item(3, 1, 2), item(1, 0, 2), item(2, 1, 1), item(4, 0, 1)];
  const tree = buildMenuTree(input);
  assert.deepEqual(
    tree.map((n) => n.id),
    [4, 1],
  );
  assert.deepEqual(
    tree[1]!.children.map((n) => n.id),
    [2, 3],
  );
  assert.equal(input[1]!.hasOwnProperty("children"), false);
});

test("buildMenuTree promotes orphans and self-parents to roots", () => {
  const tree = buildMenuTree([item(1, 99, 1), item(2, 2, 2)]);
  assert.deepEqual(
    tree.map((n) => n.id),
    [1, 2],
  );
  assert.deepEqual(buildMenuTree([]), []);
});

test("getMenuItems requests the menu and follows pagination", async () => {
  const calls: string[] = [];
  const fetch = async (url: string) => {
    calls.push(url);
    const page = new URL(url).searchParams.get("page");
    return new Response(JSON.stringify([item(page === "1" ? 1 : 2, 0, 1)]), {
      status: 200,
      headers: { "x-wp-totalpages": "2" },
    });
  };
  const wp = new WPClient({ baseUrl: "https://example.com", fetch });
  const items = await wp.getMenuItems(7);
  assert.deepEqual(
    items.map((i) => i.id),
    [1, 2],
  );
  assert.equal(calls.length, 2);
  assert.match(calls[0]!, /\/wp-json\/wp\/v2\/menu-items\?/);
  assert.match(calls[0]!, /menus=7/);
});
