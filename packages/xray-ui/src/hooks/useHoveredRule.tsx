import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export interface HoveredRuleValue {
  hoveredRuleId: string | null;
  setHoveredRuleId: (id: string | null) => void;
}

const noop = (): void => {};

/** Default value without a provider: nothing is hovered and the setter does nothing. */
const HoveredRuleContext = createContext<HoveredRuleValue>({
  hoveredRuleId: null,
  setHoveredRuleId: noop,
});

/** Shares the id of the currently hovered or focused rule between components. */
export function HoveredRuleProvider(props: { children?: ReactNode }): JSX.Element {
  const [hoveredRuleId, setHoveredRuleId] = useState<string | null>(null);
  const value = useMemo<HoveredRuleValue>(() => ({ hoveredRuleId, setHoveredRuleId }), [hoveredRuleId]);
  return <HoveredRuleContext.Provider value={value}>{props.children}</HoveredRuleContext.Provider>;
}

export function useHoveredRule(): HoveredRuleValue {
  return useContext(HoveredRuleContext);
}
