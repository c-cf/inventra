import Link from "next/link";

export type Crumb = { label: string; href?: string };

/** Parent crumbs are links; the last crumb is the current page. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-2 text-sm text-zinc-500">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.label} className="flex items-center gap-2">
              {index > 0 && <span aria-hidden="true">›</span>}
              {isLast || !item.href ? (
                <span aria-current={isLast ? "page" : undefined} className="text-zinc-900 dark:text-zinc-100">
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="hover:text-zinc-900 hover:underline dark:hover:text-zinc-100">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
