import { billing } from "@/services/billingEngine";
import { energySim } from "@/services/energySimulator";

const HOME_STORAGE_KEYS = ["mas.home.v3", "mas.home.v2"];

export function resetCompleteDemoSuite() {
  energySim.resetAll();
  billing.resetDemoInvoices();

  if (typeof window !== "undefined") {
    for (const key of HOME_STORAGE_KEYS) window.localStorage.removeItem(key);
    window.setTimeout(() => {
      window.location.reload();
    }, 140);
  }
}
