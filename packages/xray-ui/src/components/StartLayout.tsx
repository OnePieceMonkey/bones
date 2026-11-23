import type { ReactNode } from "react";
import type { CommonProps } from "../types";
import { cx } from "../cx";

export interface StartLayoutProps extends CommonProps {
  /** True while a form is shown below the cards: the headline stays at the top and the cards keep their place. */
  formShown: boolean;
  /** A `StartHeadline` and a row of sheets (give the row the class `xr-start-row`). */
  children?: ReactNode;
}

/**
 * Layout of the start view. Without a form the headline and the row of sheets
 * form one block centred vertically in the stage; with a form the layout is the
 * older one (headline at the top, sheets centred below it). Layout only.
 */
export function StartLayout({ formShown, children, className }: StartLayoutProps) {
  return (
    <div className={cx("xr-start", className)} data-form={formShown ? "shown" : "hidden"}>
      {children}
    </div>
  );
}
