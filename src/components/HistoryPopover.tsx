import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface PopoverState {
  openId: string | null;
  setOpenId: React.Dispatch<React.SetStateAction<string | null>>;
}

const HistoryPopoverContext = createContext<PopoverState | null>(null);

/** Holds the id of the single history popover that may be open at a time. */
export function HistoryPopoverProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return <HistoryPopoverContext.Provider value={{ openId, setOpenId }}>{children}</HistoryPopoverContext.Provider>;
}

/** Open state for the popover with this id; opening it closes any other one. */
export function useHistoryPopover(id: string): [boolean, (open: boolean) => void] {
  const ctx = useContext(HistoryPopoverContext);
  const [localOpen, setLocalOpen] = useState(false);
  const setOpenId = ctx?.setOpenId;

  const setOpen = useCallback(
    (open: boolean) => {
      if (!setOpenId) {
        setLocalOpen(open);
        return;
      }
      setOpenId(current => (open ? id : current === id ? null : current));
    },
    [id, setOpenId],
  );

  return [ctx ? ctx.openId === id : localOpen, setOpen];
}
