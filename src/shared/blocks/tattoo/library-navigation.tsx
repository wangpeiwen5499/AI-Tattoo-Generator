import { Link } from '@/core/i18n/navigation';

export function LibraryNavigation({
  kind,
  locale,
  listing,
}: {
  kind: 'designs' | 'history';
  locale: string;
  listing: {
    total: number;
    page: number;
    pages: number;
    q: string;
    source: string;
  };
}) {
  const zh = locale === 'zh';
  const href = (page: number) =>
    `/${kind}?${new URLSearchParams({ q: listing.q, source: listing.source, page: String(page) })}`;
  return (
    <div className="mt-8 space-y-4">
      <form
        action={`/${locale}/${kind}`}
        className="flex flex-wrap items-end gap-3"
      >
        <label>
          {zh ? '搜索名称或描述' : 'Search names or descriptions'}
          <input
            name="q"
            type="search"
            defaultValue={listing.q}
            maxLength={100}
            className="ml-2 min-h-11 rounded border px-3"
          />
        </label>
        <label>
          {zh ? '来源' : 'Source'}
          <select
            name="source"
            defaultValue={listing.source}
            className="ml-2 min-h-11 rounded border px-3"
          >
            <option value="">{zh ? '全部来源' : 'All sources'}</option>
            <option value="generated">{zh ? 'AI 生成' : 'AI generated'}</option>
            <option value="uploaded">{zh ? '上传' : 'Uploaded'}</option>
            <option value="sample">{zh ? '示例' : 'Sample'}</option>
          </select>
        </label>
        <button className="min-h-11 rounded-full border px-5">
          {zh ? '筛选' : 'Filter'}
        </button>
        {(listing.q || listing.source) && (
          <Link href={`/${kind}`} className="p-3 underline">
            {zh ? '清除' : 'Clear'}
          </Link>
        )}
      </form>
      <nav
        aria-label={zh ? '图库分页' : 'Library pagination'}
        className="flex flex-wrap items-center gap-5"
      >
        <p>
          {zh
            ? `共 ${listing.total} 条 · 第 ${listing.page} / ${listing.pages} 页`
            : `${listing.total} records · Page ${listing.page} of ${listing.pages}`}
        </p>
        {listing.page > 1 && (
          <Link
            href={href(listing.page - 1)}
            className="min-h-11 p-3 underline"
          >
            {zh ? '上一页' : 'Previous'}
          </Link>
        )}
        {listing.page < listing.pages && (
          <Link
            href={href(listing.page + 1)}
            className="min-h-11 p-3 underline"
          >
            {zh ? '下一页' : 'Next'}
          </Link>
        )}
      </nav>
      {listing.total === 0 && (listing.q || listing.source) && (
        <p role="status">
          {zh
            ? '没有匹配的记录，请调整筛选条件。'
            : 'No matching records. Try another search or source.'}
        </p>
      )}
    </div>
  );
}
