export interface PageParams {
  page: number;
  pageSize: number;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export function parsePageParams(searchParams: Record<string, string | undefined>): PageParams {
  const page = Math.max(1, parseInt(searchParams["page"] ?? "1", 10) || 1);
  const rawSize = parseInt(searchParams["pageSize"] ?? String(DEFAULT_PAGE_SIZE), 10);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize || DEFAULT_PAGE_SIZE));
  return { page, pageSize };
}

export async function paginate<T>(
  finder: (args: { take: number; skip: number }) => Promise<T[]>,
  counter: () => Promise<number>,
  params: PageParams,
): Promise<PageResult<T>> {
  const { page, pageSize } = params;
  const [items, total] = await Promise.all([
    finder({ take: pageSize, skip: (page - 1) * pageSize }),
    counter(),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
