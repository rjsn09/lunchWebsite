import { useState, useRef } from "react";

export function useToast() {
  const [toast, setToast] = useState<{ msg: string; isError: boolean; visible: boolean }>({
    msg: "",
    isError: false,
    visible: false,
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string, isError = false) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ msg, isError, visible: true });
    timerRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 2800);
  }

  return { toast, showToast };
}
