import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { cx } from "../../cx";
import type { SkeletonEnsembleProps } from "../../types";
import { Stage } from "./Stage";

const MAX_MEMBERS = 4;

/**
 * Several skeletons side by side on one shared Trace. Each member renders one
 * Stage built from `selectBones(trace, member.anatomy)` only. The name plates
 * form a radio group with a roving tabindex. With `xray` false only the plates
 * are rendered.
 */
export function SkeletonEnsemble({
  trace,
  members,
  xray,
  selectedId,
  onSelect,
  selectLabel,
  reducedMotion,
  className,
}: SkeletonEnsembleProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const shown = members.slice(0, MAX_MEMBERS);
  const selectedIndex = shown.findIndex((m) => m.id === selectedId);
  // Without a valid selection the first plate stays reachable by Tab.
  const tabIndexOf = (i: number): number => (i === (selectedIndex < 0 ? 0 : selectedIndex) ? 0 : -1);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const count = shown.length;
    if (count === 0) return;
    const current = Math.max(0, selectedIndex);
    let next: number;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (current + 1) % count;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (current - 1 + count) % count;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = count - 1;
        break;
      case "Enter":
      case " ": {
        // Handled here so activation does not depend on the browser's button click synthesis.
        const idx = shown.findIndex((m) => m.id === (e.target as HTMLElement).dataset["memberId"]);
        const hit = shown[idx];
        if (!hit) return;
        e.preventDefault();
        onSelect(hit.id);
        return;
      }
      default:
        return;
    }
    e.preventDefault();
    const target = shown[next];
    if (!target) return;
    onSelect(target.id);
    const plates = listRef.current?.querySelectorAll<HTMLElement>('[role="radio"]');
    plates?.[next]?.focus();
  };

  return (
    <div className={cx("xr-ensemble", className)} data-xray={xray ? "true" : "false"}>
      <div
        ref={listRef}
        role="radiogroup"
        aria-label={selectLabel}
        className="xr-ensemble-plates"
        data-count={shown.length}
        onKeyDown={onKeyDown}
      >
        {shown.map((m, i) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={m.id === selectedId}
            tabIndex={tabIndexOf(i)}
            className="xr-ensemble-plate"
            data-member-id={m.id}
            data-accused={m.accused ? "true" : "false"}
            onClick={() => onSelect(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      {xray && (
        <div className="xr-ensemble-stage" data-count={shown.length}>
          {shown.map((m) => (
            <div
              key={m.id}
              className="xr-ensemble-member"
              data-selected={m.id === selectedId ? "true" : "false"}
              data-accused={m.accused ? "true" : "false"}
            >
              <Stage
                trace={trace}
                anatomy={m.anatomy}
                {...(reducedMotion !== undefined ? { reducedMotion } : {})}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
