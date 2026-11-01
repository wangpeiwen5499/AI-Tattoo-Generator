import type { SVGProps } from 'react';

// A single 20px navigation family, drawn on the same 24px grid.
export function NavIcon({
  route,
  ...props
}: SVGProps<SVGSVGElement> & { route: string }) {
  const key = route.includes('#features')
    ? 'features'
    : route.split('/').filter(Boolean)[0];
  const paths: Record<string, string[]> = {
    features: ['M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z', 'M17 13v8 M13 17h8'],
    blog: [
      'M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1v14',
      'M6 8h3 M15 8h3 M6 11h3 M15 11h3',
    ],
    pricing: ['M4 6h16v13H4z M4 10h16', 'M7 15h4 M16 14v2'],
    studio: ['m5 16 10-10 3 3L8 19l-4 1z M14 7l3 3', 'M18 3v2 M21 6h-2'],
    history: ['M4 6v5h5 M4 11a8 8 0 1 1 1 6', 'M12 7v5l3 2'],
    designs: ['M7 4h13v14H7z M4 8v13h13', 'm9 14 3-4 3 3 2-2 2 3 M10 7h.01'],
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {(paths[key] || paths.studio).map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
