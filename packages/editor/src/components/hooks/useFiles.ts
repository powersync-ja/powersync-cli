import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useCallback, useEffect, useState } from 'react';
import { BehaviorSubject } from 'rxjs';

import type { FileItem } from '../../utils/files/files';

import { getConfigFiles } from '../../utils/files/files.functions';

type TrackedFile = FileItem & {
  hasChanges: boolean;
  upstreamContent: string;
};

type State = Record<string, TrackedFile>;

// Shared globally
const FILES_SUBJECT = new BehaviorSubject<State>({});

/**
 * Hook to fetch the current file content from the backend.
 */
export function useFiles() {
  const filesFunction = useServerFn(getConfigFiles);
  return useQuery({
    queryFn: () => filesFunction(),
    queryKey: ['files']
  });
}

/**
 * Smart hook to track local changes to files in comparison to the upstream content from the server. It provides a way to update the local state and determine if there are unsaved changes.
 */
export function useTrackedFiles() {
  const remoteState = useFiles();

  const [outputState, setOutputState] = useState<State>(FILES_SUBJECT.getValue());
  const [subscription] = useState(() => FILES_SUBJECT.subscribe((state) => setOutputState(state)));

  useEffect(() => () => subscription.unsubscribe(), [subscription]);

  useEffect(() => {
    // Whenever the upstream data changes (e.g. after save triggers refetch), merge server
    // state into tracked state. Preserve existing.content only when there are unsaved
    // local changes so refetch-after-save does not clobber in-flight keystrokes; when
    // there are no local changes we take upstream content so Refresh/refetch updates the
    // view. The editor is disabled during save/refetch (see BaseEditorWidget).
    if (remoteState.data) {
      const currentState = FILES_SUBJECT.getValue();
      const nextState: State = { ...currentState };

      for (const upstreamEntry of remoteState.data.files) {
        const existing = currentState[upstreamEntry.filename];
        const hasLocalChanges = existing && existing.content !== existing.upstreamContent;

        nextState[upstreamEntry.filename] = {
          ...upstreamEntry,
          content: hasLocalChanges ? existing.content : upstreamEntry.content,
          filename: upstreamEntry.filename,
          hasChanges: existing ? existing.content !== upstreamEntry.content : false,
          upstreamContent: upstreamEntry.content
        };
      }

      FILES_SUBJECT.next(nextState);
    }
  }, [remoteState.data]);

  const updateLocalState = useCallback((filename: string, content: string) => {
    const currentState = FILES_SUBJECT.getValue();
    const existing = currentState[filename];

    const nextState: State = {
      ...currentState,
      [filename]: {
        ...existing,
        content,
        hasChanges: existing ? content !== existing.upstreamContent : false,
        upstreamContent: existing?.upstreamContent ?? ''
      }
    };

    FILES_SUBJECT.next(nextState);
  }, []);

  return {
    state: outputState,
    updateLocalState,
    upstream: remoteState
  };
}
