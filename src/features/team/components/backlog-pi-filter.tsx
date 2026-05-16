"use client";

import { useRouter, usePathname } from "@/i18n/navigation";

interface Pi {
  id: string;
  name: string;
}

interface Props {
  pis: Pi[];
  currentPiId?: string | undefined;
}

export function BacklogPiFilter({ pis, currentPiId }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const url = new URL(window.location.href);
    if (e.target.value) url.searchParams.set("piId", e.target.value);
    else url.searchParams.delete("piId");
    router.replace(`${pathname}?${url.searchParams.toString()}`);
  }

  return (
    <select
      name="piId"
      defaultValue={currentPiId ?? ""}
      onChange={handleChange}
      className="rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">All PIs</option>
      {pis.map((pi) => (
        <option key={pi.id} value={pi.id}>
          {pi.name}
        </option>
      ))}
    </select>
  );
}
