import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

type Product = {
  id: number;
  name: string;
  price: number;
};

type ProductInput = {
  name: string;
  price: number;
};

type DialogState =
  | { kind: 'create' }
  | { kind: 'edit' | 'delete'; product: Product }
  | null;

type ActionButtonProps = {
  children: React.ReactNode;
  onAction: () => void;
  variant?: 'secondary' | 'danger';
  disabled?: boolean;
};

function ActionButton({
  children,
  onAction,
  variant = 'secondary',
  disabled = false,
}: ActionButtonProps) {
  return (
    <button
      className={`button button-${variant}`}
      type="button"
      onClick={onAction}
      disabled={disabled}
    >
      {children}
    </button>
  );
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
    throw new Error(message);
  }

  return payload as T;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui.';
}

function formatPrice(price: number) {
  return `Rp${new Intl.NumberFormat('id-ID').format(price)}`;
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
    <div className="dialog-backdrop">
      <section
        aria-labelledby="dialog-title"
        aria-modal="true"
        className="dialog"
        role="dialog"
      >
        <div className="dialog-heading">
          <h2 id="dialog-title">
            {dialog.kind === 'create'
              ? 'Tambah Produk'
              : dialog.kind === 'edit'
                ? 'Edit Produk'
                : 'Hapus Produk?'}
          </h2>
          <button
            aria-label="Tutup dialog"
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        {dialog.kind === 'delete' ? (
          <>
            <p>
              Hapus <strong>{dialog.product.name}</strong> ({formatPrice(dialog.product.price)})?
              Tindakan ini tidak dapat dibatalkan.
            </p>
            {error && <p className="message message-error" role="alert">{error}</p>}
            <div className="dialog-actions">
              <ActionButton onAction={onClose} disabled={pending}>
                Batal
              </ActionButton>
              <button
                className="button button-danger"
                disabled={pending}
                onClick={handleDelete}
                type="button"
              >
                {pending ? 'Menghapus...' : 'Hapus Produk'}
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label htmlFor="product-name">Nama Produk</label>
            <input
              autoFocus
              id="product-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Contoh: Pulpen"
              required
              value={name}
            />

            <label htmlFor="product-price">Harga (Rp)</label>
            <input
              id="product-price"
              min="0"
              onChange={(event) => setPrice(event.target.value)}
              placeholder="Contoh: 5000"
              required
              step="1"
              type="number"
              value={price}
            />
            <p className="field-hint">Harga harus berupa bilangan bulat dan tidak negatif.</p>

            {error && <p className="message message-error" role="alert">{error}</p>}
            <div className="dialog-actions">
              <ActionButton onAction={onClose} disabled={pending}>
                Batal
              </ActionButton>
              <button className="button button-primary" disabled={pending} type="submit">
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

export default function App() {
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
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Inventaris</p>
          <h1>Manajemen Produk</h1>
          <p className="subtitle">Kelola nama dan harga produk Anda.</p>
        </div>
        <button
          className="button button-primary"
          onClick={() => setDialog({ kind: 'create' })}
          type="button"
        >
          Tambah Produk
        </button>
      </header>

      <section aria-label="Daftar produk" className="product-section">
        <div className="list-toolbar">
          <label className="search-label" htmlFor="product-search">
            Cari produk
          </label>
          <input
            id="product-search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama produk..."
            type="search"
            value={search}
          />
          <span className="product-count">
            {filteredProducts.length} dari {products.length} produk
          </span>
        </div>

        {pageError && <p className="message message-error" role="alert">{pageError}</p>}
        {loading ? (
          <p aria-live="polite" className="empty-state">Memuat produk...</p>
        ) : filteredProducts.length === 0 ? (
          <p className="empty-state">
            {products.length === 0
              ? 'Belum ada produk. Tambahkan produk pertama Anda.'
              : 'Produk tidak ditemukan.'}
          </p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Nama Produk</th>
                  <th scope="col">Harga</th>
                  <th scope="col">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td>{product.id}</td>
                    <td>{product.name}</td>
                    <td>{formatPrice(product.price)}</td>
                    <td>
                      <div className="row-actions">
                        <ActionButton
                          onAction={() => setDialog({ kind: 'edit', product })}
                        >
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
    </main>
  );
}
