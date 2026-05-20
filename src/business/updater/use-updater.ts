import { useCallback, useEffect, useState } from 'react';
import { updaterApi, type UpdaterStatus } from '../../api/updater';

export function useUpdater() {
  const [status, setStatus] = useState<UpdaterStatus | null>(null);

  useEffect(() => {
    let mounted = true;
    void updaterApi.getStatus().then((s) => {
      if (mounted) setStatus(s);
    });
    const off = updaterApi.onStatus((event) => {
      if (mounted) setStatus(event);
    });
    return () => {
      mounted = false;
      off();
    };
  }, []);

  const check = useCallback(async () => {
    const next = await updaterApi.check();
    setStatus(next);
  }, []);

  const install = useCallback(async () => {
    await updaterApi.quitAndInstall();
  }, []);

  return { status, check, install };
}
