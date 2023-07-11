import { useCallback, useMemo } from 'react';
import { useRecoilState } from 'recoil';

import { useSetHotkeysScope } from '@/hotkeys/hooks/useSetHotkeysScope';
import { InternalHotkeysScope } from '@/hotkeys/types/internal/InternalHotkeysScope';
import { useRecoilScopedState } from '@/recoil-scope/hooks/useRecoilScopedState';
import { useSetSoftFocusPosition } from '@/ui/tables/hooks/useSetSoftFocusPosition';
import { CellContext } from '@/ui/tables/states/CellContext';
import { currentColumnNumberScopedState } from '@/ui/tables/states/currentColumnNumberScopedState';
import { currentRowNumberScopedState } from '@/ui/tables/states/currentRowNumberScopedState';
import { isSoftFocusActiveState } from '@/ui/tables/states/isSoftFocusActiveState';
import { RowContext } from '@/ui/tables/states/RowContext';
import { CellPosition } from '@/ui/tables/types/CellPosition';

export function useSetSoftFocusOnCurrentCell() {
  const setSoftFocusPosition = useSetSoftFocusPosition();
  const [currentRowNumber] = useRecoilScopedState(
    currentRowNumberScopedState,
    RowContext,
  );

  const [currentColumnNumber] = useRecoilScopedState(
    currentColumnNumberScopedState,
    CellContext,
  );

  const currentTablePosition: CellPosition = useMemo(
    () => ({
      column: currentColumnNumber,
      row: currentRowNumber,
    }),
    [currentColumnNumber, currentRowNumber],
  );

  const [, setIsSoftFocusActive] = useRecoilState(isSoftFocusActiveState);

  const setHotkeysScope = useSetHotkeysScope();

  return useCallback(() => {
    setSoftFocusPosition(currentTablePosition);
    setIsSoftFocusActive(true);
    setHotkeysScope(InternalHotkeysScope.TableSoftFocus);
  }, [
    setSoftFocusPosition,
    currentTablePosition,
    setIsSoftFocusActive,
    setHotkeysScope,
  ]);
}
