import { billing } from "@/services/billingEngine";
import { energySim } from "@/services/energySimulator";

const HOME_STORAGE_KEY = "mas.home.v2";

export function resetCompleteDemoSuite() {
  energySim.resetAll();
  billing.resetDemoInvoices();

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(HOME_STORAGE_KEY);
    window.setTimeout(() => {
      window.location.reload();
    }, 140);
  }
}
