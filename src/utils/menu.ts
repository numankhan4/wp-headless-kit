import type { WPMenuItem, WPMenuTreeNode } from "../client/types.js";

/** Nest flat menu items by `parent`, sorted by `menu_order`; items whose parent is missing become roots. */
export function buildMenuTree<T extends WPMenuItem>(items: readonly T[]): Array<WPMenuTreeNode<T>> {
  const nodes = new Map<number, WPMenuTreeNode<T>>();
  for (const item of items) nodes.set(item.id, { ...item, children: [] });
  const roots: Array<WPMenuTreeNode<T>> = [];
  for (const item of items) {
    const node = nodes.get(item.id)!;
    const parent = item.parent !== item.id ? nodes.get(item.parent) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  const sort = (list: Array<WPMenuTreeNode<T>>): void => {
    list.sort((a, b) => a.menu_order - b.menu_order);
    for (const node of list) sort(node.children);
  };
  sort(roots);
  return roots;
}
