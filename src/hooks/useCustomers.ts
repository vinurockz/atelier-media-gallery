import { useCallback, useEffect, useState } from "react";
import type { Customer } from "@/types/customer";
import {
  createCustomer,
  deleteCustomer as deleteCustomerRemote,
  fetchCustomers,
  selectCustomer as selectCustomerRemote,
  updateCustomer,
  uploadCustomerPhoto,
  type CustomerPatch,
} from "@/lib/api/customers";

/**
 * The signed-in account's customers (name/description/photo) plus which one the session
 * currently has active. Customer records themselves live in the server's top-level store
 * (never customer-scoped — see server/db.mjs's topDb); everything else a customer owns
 * (Files, Chat, Notes, ...) lives behind entering it, not here.
 */
export function useCustomers(
  onActiveCustomerChange: (id: string | null) => void,
) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const list = await fetchCustomers();
    setCustomers(list);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addCustomer = useCallback(async (name: string, description: string) => {
    const customer = await createCustomer(name, description);
    setCustomers((prev) => [...prev, customer]);
    return customer;
  }, []);

  const patchCustomer = useCallback(
    async (id: string, patch: CustomerPatch) => {
      const updated = await updateCustomer(id, patch);
      setCustomers((prev) => prev.map((c) => (c.id === id ? updated : c)));
    },
    [],
  );

  const removeCustomer = useCallback(async (id: string) => {
    await deleteCustomerRemote(id);
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const setPhoto = useCallback(async (id: string, file: File) => {
    const updated = await uploadCustomerPhoto(id, file);
    setCustomers((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }, []);

  const enterCustomer = useCallback(
    async (id: string) => {
      const user = await selectCustomerRemote(id);
      onActiveCustomerChange(user.activeCustomerId);
    },
    [onActiveCustomerChange],
  );

  const leaveCustomer = useCallback(async () => {
    const user = await selectCustomerRemote(null);
    onActiveCustomerChange(user.activeCustomerId);
  }, [onActiveCustomerChange]);

  return {
    customers,
    loaded,
    addCustomer,
    patchCustomer,
    removeCustomer,
    setPhoto,
    enterCustomer,
    leaveCustomer,
  };
}
