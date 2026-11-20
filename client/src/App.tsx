import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useParams,
} from 'react-router';

type Product = {
  id: number;
  name: string;
  price: number;
};

type ProductInput = {
  name: string;
  price: number;
};

type ProductView = 'grid' | 'list';

type DialogState =
  | { kind: 'create' }
  | { kind: 'edit' | 'delete'; product: Product }
  | null;

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload &&
      typeof payload.message === 'string'
        ? payload.message
        : `Permintaan gagal (HTTP ${response.status})`;
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui.';
}

function formatPrice(price: number) {
  return `Rp${new Intl.NumberFormat('id-ID').format(price)}`;
}

function ActionButton({
  children,
  onAction,
  variant = 'secondary',
  disabled = false,
}: {
  children: ReactNode;
  onAction: () => void;
  variant?: 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const styles =
    variant === 'danger'
      ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
      : 'border-slate-200 text-slate-700 hover:bg-slate-50';

  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${styles}`}
      type="button"
      onClick={onAction}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

type ProductDialogProps = {
  dialog: Exclude<DialogState, null>;
  onClose: () => void;
  onSave: (product: ProductInput, id?: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
};

function ProductDialog({ dialog, onClose, onSave, onDelete }: ProductDialogProps) {
  const product = dialog.kind === 'create' ? null : dialog.product;
  const [name, setName] = useState(product?.name ?? '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const numericPrice = Number(price);

    if (!trimmedName) {
      setError('Masukkan nama produk.');
      return;
    }
    if (!Number.isInteger(numericPrice) || numericPrice < 0) {
      setError('Harga harus berupa bilangan bulat yang tidak negatif.');
      return;
    }

    setPending(true);
    setError('');
    try {
      await onSave({ name: trimmedName, price: numericPrice }, product?.id);
      onClose();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    if (!product) return;

    setPending(true);
    setError('');
    try {
      await onDelete(product.id);
      onClose();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 grid place-items-center overflow-y-auto bg-slate-950/45 p-4">
      <section
        aria-labelledby="dialog-title"
        aria-modal="true"
        className="my-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        role="dialog"
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-slate-900" id="dialog-title">
            {dialog.kind === 'create'
              ? 'Tambah Produk'
              : dialog.kind === 'edit'
                ? 'Edit Produk'
                : 'Hapus Produk?'}
          </h2>
          <button
            aria-label="Tutup dialog"
            className="grid size-9 place-items-center rounded-lg text-2xl leading-none text-slate-500 hover:bg-slate-100"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        {dialog.kind === 'delete' ? (
          <>
            <p className="text-sm leading-6 text-slate-600">
              Hapus <strong className="text-slate-900">{dialog.product.name}</strong> (
              {formatPrice(dialog.product.price)})? Tindakan ini tidak dapat dibatalkan.
            </p>
            {error && (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
                {error}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <ActionButton onAction={onClose} disabled={pending}>
                Batal
              </ActionButton>
              <button
                className="min-h-10 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60"
                disabled={pending}
                onClick={handleDelete}
                type="button"
              >
                {pending ? 'Menghapus...' : 'Hapus Produk'}
              </button>
            </div>
          </>
        ) : (
          <form className="grid gap-2" onSubmit={handleSubmit}>
            <label className="mt-2 text-sm font-semibold text-slate-700" htmlFor="product-name">
              Nama Produk
            </label>
            <input
              autoFocus
              className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              id="product-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Contoh: Pulpen"
              required
              value={name}
            />

            <label className="mt-3 text-sm font-semibold text-slate-700" htmlFor="product-price">
              Harga (Rp)
            </label>
            <input
              className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              id="product-price"
              min="0"
              onChange={(event) => setPrice(event.target.value)}
              placeholder="Contoh: 5000"
              required
              step="1"
              type="number"
              value={price}
            />
            <p className="mb-2 text-xs text-slate-500">
              Harga harus berupa bilangan bulat dan tidak negatif.
            </p>

            {error && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
                {error}
              </p>
            )}
            <div className="mt-3 flex justify-end gap-3">
              <ActionButton onAction={onClose} disabled={pending}>
                Batal
              </ActionButton>
              <button
                className="min-h-10 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60"
                disabled={pending}
                type="submit"
              >
                {pending
                  ? 'Menyimpan...'
                  : dialog.kind === 'create'
                    ? 'Simpan Produk'
                    : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function PageLayout() {
  const navClassName = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
      isActive ? 'bg-blue-50 text-blue-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Link className="flex items-center gap-3" to="/products">
            <span className="grid size-10 place-items-center rounded-xl bg-blue-700 text-sm font-black text-white">
              IP
            </span>
            <span>
              <span className="block text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                Inventaris
              </span>
              <span className="block text-lg font-bold text-slate-900">Manajemen Produk</span>
            </span>
          </Link>
          <nav aria-label="Navigasi utama" className="flex items-center gap-2">
            <NavLink className={navClassName} to="/products">
              Produk
            </NavLink>
            <NavLink className={navClassName} to="/settings">
              Settings
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-5 text-xs text-slate-500 sm:px-6">
          Inventaris · Kelola data produk dengan mudah
        </div>
      </footer>
    </div>
  );
}

function ProductsPage({ viewMode }: { viewMode: ProductView }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      try {
        const result = await request<Product[]>('/products', { signal: controller.signal });
        setProducts(result);
      } catch (error) {
        if (!controller.signal.aborted) setPageError(getErrorMessage(error));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadProducts();
    return () => controller.abort();
  }, []);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('id-ID');
    if (!query) return products;
    return products.filter((product) => product.name.toLocaleLowerCase('id-ID').includes(query));
  }, [products, search]);

  async function saveProduct(input: ProductInput, id?: number) {
    if (id === undefined) {
      const created = await request<Product>('/products', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setProducts((current) => [...current, created].sort((a, b) => a.id - b.id));
    } else {
      const updated = await request<Product>(`/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...input, id }),
      });
      setProducts((current) => current.map((item) => (item.id === id ? updated : item)));
    }
    setPageError('');
  }

  async function deleteProduct(id: number) {
    await request<{ message: string }>(`/products/${id}`, { method: 'DELETE' });
    setProducts((current) => current.filter((product) => product.id !== id));
    setPageError('');
  }

  return (
    <>
      <section className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.16em] text-blue-700">
            Ruang kerja
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Daftar Produk
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
            Tambah, lihat detail, edit, dan hapus produk dari satu tempat.
          </p>
        </div>
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800"
          onClick={() => setDialog({ kind: 'create' })}
          type="button"
        >
          <span aria-hidden="true" className="mr-2 text-lg leading-none">+</span>
          Tambah Produk
        </button>
      </section>

      <section aria-label="Daftar produk" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-base font-bold text-slate-900">Semua produk</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {filteredProducts.length} dari {products.length}
            </span>
          </div>
          <label className="block w-full sm:max-w-xs">
            <span className="sr-only">Cari produk</span>
            <input
              className="min-h-10 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama produk..."
              type="search"
              value={search}
            />
          </label>
        </div>

        {pageError && (
          <p className="m-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
            {pageError}
          </p>
        )}
        {loading ? (
          <p aria-live="polite" className="px-5 py-12 text-center text-sm text-slate-500">
            Memuat produk...
          </p>
        ) : filteredProducts.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">
            {products.length === 0
              ? 'Belum ada produk. Tambahkan produk pertama Anda.'
              : 'Produk tidak ditemukan.'}
          </p>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
            {filteredProducts.map((product) => (
              <article
                className="flex min-h-56 flex-col rounded-xl border border-slate-200 bg-white p-5 transition hover:border-blue-200 hover:shadow-md"
                key={product.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800">
                    ID #{product.id}
                  </span>
                  <span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-slate-100 text-lg font-bold text-slate-500">
                    {product.name.trim().charAt(0).toLocaleUpperCase('id-ID')}
                  </span>
                </div>
                <h3 className="mt-5 break-words text-lg font-bold text-slate-900">{product.name}</h3>
                <p className="mt-1 text-sm text-slate-500">Harga</p>
                <p className="mt-1 text-xl font-bold text-blue-800">{formatPrice(product.price)}</p>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
                  <Link
                    className="text-sm font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                    to={`/products/${product.id}`}
                  >
                    Lihat detail
                  </Link>
                  <div className="flex gap-2">
                    <ActionButton onAction={() => setDialog({ kind: 'edit', product })}>
                      Edit
                    </ActionButton>
                    <ActionButton
                      onAction={() => setDialog({ kind: 'delete', product })}
                      variant="danger"
                    >
                      Hapus
                    </ActionButton>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500" scope="col">
                    ID
                  </th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500" scope="col">
                    Nama Produk
                  </th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500" scope="col">
                    Harga
                  </th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500" scope="col">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr className="border-t border-slate-100" key={product.id}>
                    <td className="px-5 py-4 text-sm text-slate-500">{product.id}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">{product.name}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                      {formatPrice(product.price)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          className="rounded-lg px-2 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                          to={`/products/${product.id}`}
                        >
                          Detail
                        </Link>
                        <ActionButton onAction={() => setDialog({ kind: 'edit', product })}>
                          Edit
                        </ActionButton>
                        <ActionButton
                          onAction={() => setDialog({ kind: 'delete', product })}
                          variant="danger"
                        >
                          Hapus
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {dialog && (
        <ProductDialog
          dialog={dialog}
          onClose={() => setDialog(null)}
          onDelete={deleteProduct}
          onSave={saveProduct}
        />
      )}
    </>
  );
}

function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProduct() {
      setLoading(true);
      setError('');
      setNotFound(false);
      setProduct(null);

      if (!id || !/^[1-9]\d*$/.test(id)) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        const result = await request<Product>(`/products/${id}`, {
          signal: controller.signal,
        });
        setProduct(result);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        if (loadError instanceof ApiError && loadError.status === 404) {
          setNotFound(true);
        } else {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadProduct();
    return () => controller.abort();
  }, [id]);

  if (loading) {
    return <p aria-live="polite" className="py-16 text-center text-sm text-slate-500">Memuat detail produk...</p>;
  }

  if (notFound) {
    return (
      <section className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm sm:p-12">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-amber-700">Tidak ditemukan</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
          Produk tidak ditemukan
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Produk dengan ID {id ?? 'yang diminta'} tidak tersedia. Periksa kembali alamat atau pilih produk dari daftar.
        </p>
        <Link
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          to="/products"
        >
          Kembali ke produk
        </Link>
      </section>
    );
  }

  if (error || !product) {
    return (
      <section className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm sm:p-12">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-rose-700">Terjadi kendala</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-950">Detail produk gagal dimuat</h1>
        <p className="mt-3 text-sm text-rose-800" role="alert">
          {error || 'Data produk tidak tersedia.'}
        </p>
        <Link
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          to="/products"
        >
          Kembali ke produk
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900 hover:underline"
        to="/products"
      >
        <span aria-hidden="true">←</span> Kembali ke produk
      </Link>
      <article className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white px-6 py-7 sm:px-8">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">
            Detail produk · ID #{product.id}
          </p>
          <h1 className="mt-3 break-words text-3xl font-bold tracking-tight text-slate-950">
            {product.name}
          </h1>
        </div>
        <dl className="grid gap-5 p-6 sm:grid-cols-2 sm:p-8">
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-sm font-medium text-slate-500">ID Produk</dt>
            <dd className="mt-2 text-lg font-bold text-slate-900">{product.id}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-sm font-medium text-slate-500">Harga</dt>
            <dd className="mt-2 text-lg font-bold text-blue-800">{formatPrice(product.price)}</dd>
          </div>
        </dl>
      </article>
    </section>
  );
}

function SettingsPage({
  viewMode,
  onViewModeChange,
}: {
  viewMode: ProductView;
  onViewModeChange: (mode: ProductView) => void;
}) {
  return (
    <section className="mx-auto max-w-3xl">
      <p className="mb-2 text-sm font-bold uppercase tracking-[0.16em] text-blue-700">Preferensi</p>
      <h1 className="text-3xl font-bold tracking-tight text-slate-950">Settings</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Sesuaikan cara produk ditampilkan pada halaman daftar.
      </p>

      <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <fieldset>
          <legend className="text-base font-bold text-slate-900">Tampilan produk</legend>
          <p className="mt-1 text-sm text-slate-500">
            Pilihan ini disimpan di browser dan digunakan pada halaman produk.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {([
              ['grid', 'Grid', 'Kartu produk dalam beberapa kolom'],
              ['list', 'List', 'Tabel produk yang ringkas'],
            ] as const).map(([mode, label, description]) => (
              <button
                aria-pressed={viewMode === mode}
                className={`rounded-xl border p-4 text-left transition ${
                  viewMode === mode
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
                key={mode}
                onClick={() => onViewModeChange(mode)}
                type="button"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="font-bold text-slate-900">{label}</span>
                  <span
                    className={`grid size-5 place-items-center rounded-full border ${
                      viewMode === mode ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300'
                    }`}
                  >
                    {viewMode === mode && <span aria-hidden="true" className="size-2 rounded-full bg-white" />}
                  </span>
                </span>
                <span className="mt-2 block text-sm text-slate-600">{description}</span>
              </button>
            ))}
          </div>
          <p aria-live="polite" className="mt-4 text-sm font-medium text-emerald-700">
            Tampilan {viewMode === 'grid' ? 'grid' : 'list'} sedang aktif.
          </p>
        </fieldset>
      </div>
    </section>
  );
}

function NotFoundPage() {
  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">404</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
        Halaman tidak ditemukan
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Alamat yang Anda buka tidak tersedia atau sudah dipindahkan.
      </p>
      <Link
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
        to="/products"
      >
        Kembali ke produk
      </Link>
    </section>
  );
}

export default function App() {
  const [viewMode, setViewMode] = useState<ProductView>(() => {
    const savedMode = window.localStorage.getItem('product-view-mode');
    return savedMode === 'grid' ? 'grid' : 'list';
  });

  useEffect(() => {
    window.localStorage.setItem('product-view-mode', viewMode);
  }, [viewMode]);

  return (
    <Routes>
      <Route element={<PageLayout />}>
        <Route index element={<Navigate replace to="/products" />} />
        <Route element={<ProductsPage viewMode={viewMode} />} path="products" />
        <Route element={<ProductDetailPage />} path="products/:id" />
        <Route
          element={
            <SettingsPage onViewModeChange={setViewMode} viewMode={viewMode} />
          }
          path="settings"
        />
        <Route element={<NotFoundPage />} path="*" />
      </Route>
    </Routes>
  );
}
