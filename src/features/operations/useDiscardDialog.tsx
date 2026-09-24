import { useEffect, useId, useRef, useState } from 'react';

export function useDiscardDialog() {
  const [message, setMessage] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const resolve = useRef<((accepted: boolean) => void) | null>(null);
  const origin = useRef<HTMLElement | null>(null);
  const id = useId();
  useEffect(() => () => { resolve.current?.(false); resolve.current = null; }, []);
  useEffect(() => { if (message) dialog.current?.showModal(); }, [message]);
  function finish(accepted: boolean) {
    dialog.current?.close();
    setMessage(null);
    const done = resolve.current;
    resolve.current = null;
    origin.current?.focus({ preventScroll: true });
    done?.(accepted);
  }
  const confirmDiscard = (text: string) => {
    if (resolve.current) return Promise.resolve(false);
    origin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMessage(text);
    return new Promise<boolean>(done => { resolve.current = done; });
  };
  const discardDialog = <dialog ref={dialog} className="op-discard-dialog" aria-labelledby={id} aria-describedby={id + '-message'} onCancel={event => { event.preventDefault(); finish(false); }}>
    <h2 id={id}>Descartar cambios sin guardar</h2>
    <p id={id + '-message'}>{message}</p>
    <div><button type="button" autoFocus onClick={() => finish(false)}>Seguir editando</button><button type="button" onClick={() => finish(true)}>Descartar cambios</button></div>
  </dialog>;
  return { confirmDiscard, discardDialog };
}
