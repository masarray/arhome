import { useEffect, useState } from "react";
import { energySim, type Snapshot } from "@/services/energySimulator";

export function useEnergyStream(): Snapshot {
  const [snap, setSnap] = useState<Snapshot>(() => energySim.snapshot());
  useEffect(() => {
    const unsub = energySim.subscribe(setSnap);
    return () => {
      unsub();
    };
  }, []);
  return snap;
}
