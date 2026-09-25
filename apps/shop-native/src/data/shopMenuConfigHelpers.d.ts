import type { ShopCustomizeGroup } from './shopMenuConfig';

export function parseCustomizeOptionLabels(input: string): string[];
export function activeCustomizeGroupsForCategory(groups: ShopCustomizeGroup[], categoryId: string | null): ShopCustomizeGroup[];
