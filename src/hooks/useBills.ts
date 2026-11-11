import { useCallback, useEffect, useState } from "react";
import type { Bill } from "@/types/bill";
import {
  createBill,
  deleteBill,
  fetchBills,
  updateBill,
  type BillPatch,
} from "@/lib/api/bills";

/** Bills/quotations, backed by the Node API in `server/` — same durable-JSON-file model as
 * contents/notes. Unlike Notes, edits save explicitly (the editor has its own Save button)
 * rather than autosaving on every keystroke, since a half-filled bill mid-edit isn't
 * meaningful to persist. */
export function useBills() {
  const [bills, setBills] = useState<Bill[]>([]);

  useEffect(() => {
    fetchBills()
      .then(setBills)
      .catch(() => {
        // No backend reachable yet — bills just stays empty until it is.
      });
  }, []);

  const addBill = useCallback(async (docType: Bill["docType"]) => {
    const bill = await createBill(docType);
    setBills((prev) => [bill, ...prev]);
    return bill.id;
  }, []);

  const editBill = useCallback(async (id: string, patch: BillPatch) => {
    const updated = await updateBill(id, patch);
    setBills((prev) => prev.map((b) => (b.id === id ? updated : b)));
  }, []);

  const removeBill = useCallback(async (id: string) => {
    await deleteBill(id);
    setBills((prev) => prev.filter((b) => b.id !== id));
  }, []);

  return { bills, addBill, editBill, removeBill };
}
