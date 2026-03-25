"use client";

import { createContext, useContext, useState } from "react";

type ModalType = "export" | "schedule-report" | "invite-member" | null;

interface ModalState {
  type: ModalType;
  props?: Record<string, unknown>;
}

interface ModalContextType {
  modal: ModalState;
  openModal: (type: ModalType, props?: Record<string, unknown>) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextType>({
  modal: { type: null },
  openModal: () => {},
  closeModal: () => {},
});

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalState>({ type: null });

  const openModal = (type: ModalType, props?: Record<string, unknown>) => {
    setModal({ type, props });
  };

  const closeModal = () => {
    setModal({ type: null });
  };

  return (
    <ModalContext.Provider value={{ modal, openModal, closeModal }}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  return useContext(ModalContext);
}

export default ModalProvider;
