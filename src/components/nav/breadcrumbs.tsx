import type { ComponentProps } from "react";
import { Link } from "@/i18n/navigation";

type Href = ComponentProps<typeof Link>["href"];

export interface Crumb {
  label: string;
  href?: Href;
}

/** Consistent breadcrumb trail. The last item is rendered as the current page. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="text-sm text-gray-500 flex items-center gap-1 flex-wrap">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-gray-300">/</span>}
          {item.href ? (
            <Link href={item.href} className="hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-800 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
