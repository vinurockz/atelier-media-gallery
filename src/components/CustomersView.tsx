import { useState } from "react";
import type { Customer } from "@/types/customer";
import type { CustomerPatch } from "@/lib/api/customers";
import { customerPhotoUrl } from "@/lib/api/customers";
import { CustomerEditorModal } from "@/components/CustomerEditorModal";
import { FilmIcon, PencilIcon, PlusIcon, TrashIcon } from "@/components/icons";

type Props = {
  userName: string;
  customers: Customer[];
  loaded: boolean;
  onCreate: (name: string, description: string) => Promise<Customer>;
  onPatch: (id: string, patch: CustomerPatch) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSetPhoto: (id: string, file: File) => Promise<void>;
  onEnter: (id: string) => Promise<void>;
  onLogout: () => Promise<void>;
};

/** Shown once signed in but before entering a customer — every other module's data lives
 * behind picking one of these. Each customer is its own completely separate workspace. */
export function CustomersView({
  userName,
  customers,
  loaded,
  onCreate,
  onPatch,
  onDelete,
  onSetPhoto,
  onEnter,
  onLogout,
}: Props) {
  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const [entering, setEntering] = useState<string | null>(null);

  const handleEnter = async (id: string) => {
    setEntering(id);
    try {
      await onEnter(id);
    } finally {
      setEntering(null);
    }
  };

  const handleDelete = async (customer: Customer) => {
    if (
      !window.confirm(
        `Delete "${customer.name}"? Everything inside it — Files, Chat, Notes, every module's data — will be permanently deleted too.`,
      )
    ) {
      return;
    }
    await onDelete(customer.id);
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-linen bg-surface px-4 py-3.5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-surface">
            <FilmIcon className="size-4" />
          </span>
          <span className="font-serif text-[1.2rem] leading-none text-ink">
            Atelier
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-stone sm:inline">
            Signed in as {userName}
          </span>
          <button
            type="button"
            onClick={() => void onLogout()}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-stone transition hover:bg-linen-hover"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="font-serif text-[1.75rem] text-ink">
              Your customers
            </h1>
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-accent-hover"
            >
              <PlusIcon className="size-3.5" />
              New customer
            </button>
          </div>

          {loaded && customers.length === 0 ? (
            <p className="py-16 text-center text-sm text-stone">
              No customers yet. Create one to start working inside it — Files,
              Chat, Notes, and every other tool live separately per customer.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => void handleEnter(customer.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void handleEnter(customer.id);
                    }
                  }}
                  className="group relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-linen bg-white p-5 text-center shadow-soft transition hover:shadow-lifted"
                >
                  <div className="size-16 overflow-hidden rounded-full bg-linen">
                    {customer.hasPhoto ? (
                      <img
                        src={customerPhotoUrl(customer.id)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xl font-semibold text-stone">
                        {customer.name.trim().slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <h2 className="truncate text-sm font-medium text-ink">
                    {customer.name}
                  </h2>
                  {customer.description && (
                    <p className="line-clamp-2 text-xs text-stone">
                      {customer.description}
                    </p>
                  )}
                  {entering === customer.id && (
                    <span className="text-xs text-accent">Entering…</span>
                  )}

                  <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(customer);
                      }}
                      aria-label="Edit customer"
                      className="flex size-6 items-center justify-center rounded-full bg-white text-stone shadow ring-1 ring-black/5 hover:text-ink"
                    >
                      <PencilIcon className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(customer);
                      }}
                      aria-label="Delete customer"
                      className="flex size-6 items-center justify-center rounded-full bg-white text-stone shadow ring-1 ring-black/5 hover:text-red-600"
                    >
                      <TrashIcon className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <CustomerEditorModal
          customer={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(name, description) =>
            editing === "new"
              ? onCreate(name, description)
              : onPatch(editing.id, { name, description }).then(() => editing)
          }
          onSetPhoto={onSetPhoto}
        />
      )}
    </div>
  );
}
