import { useEffect, useState } from "react";
import { billing, type Invoice } from "@/services/billingEngine";

export function useInvoices(): Invoice[] {
  const [list, setList] = useState<Invoice[]>(() => billing.list());
  useEffect(() => {
    const unsub = billing.subscribe(setList);
    return () => {
      unsub();
    };
  }, []);
  return list;
}
