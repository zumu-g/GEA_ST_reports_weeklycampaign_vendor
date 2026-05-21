export const CLICKUP_LIST_IDS: Record<string, string> = {
  '85-centenary-blvd-officer-south': '901611120989',
  '14-hartsmere-dr-berwick': '901612396080',
  // '9-calibar-ct-clyde-north': '' — add list ID once ClickUp list is created
};

export function getSlugForListId(listId: string): string | null {
  const entry = Object.entries(CLICKUP_LIST_IDS).find(([, id]) => id === listId);
  return entry ? entry[0] : null;
}

export interface CampaignTask {
  id: string;
  name: string;
  dueDate: string | null;
  priority: string | null;
}
