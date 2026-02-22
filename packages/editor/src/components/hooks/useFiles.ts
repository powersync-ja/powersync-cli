import type { FileItem } from '@/utils/files/files';
import { getConfigFiles } from '@/utils/files/files.functions';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useCallback, useEffect, useState } from 'react';
import { BehaviorSubject } from 'rxjs';

type TrackedFile = FileItem & {
  upstreamContent: string;
  hasChanges: boolean;
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
    queryKey: ['files'],
    queryFn: () => filesFunction()
  });
}

/**
 * Smart hook to track local changes to files in comparison to the upstream content from the server. It provides a way to update the local state and determine if there are unsaved changes.
 */
export function useTrackedFiles() {
  const remoteState = useFiles();

  const [outputState, setOutputState] = useState<State>(FILES_SUBJECT.getValue());
  const [subscription] = useState(() => FILES_SUBJECT.subscribe((state) => setOutputState(state)));

  useEffect(() => {
    return () => subscription.unsubscribe();
  }, [subscription]);

  useEffect(() => {
    // Whenever the upstream data changes
    if (remoteState.data) {
      // set the initial state from the server
      remoteState.data?.files.forEach((upstreamEntry) => {
        const existing = outputState[upstreamEntry.filename];
        outputState[upstreamEntry.filename] = {
          ...upstreamEntry,
          upstreamContent: upstreamEntry.content,
          hasChanges: existing ? existing.content !== upstreamEntry.content : false,
          filename: upstreamEntry.filename
        };
      });
      // update state as a whole
      FILES_SUBJECT.next({ ...outputState });
    }
  }, [remoteState.data]);

  const updateLocalState = useCallback((filename: string, content: string) => {
    const existing = outputState[filename];
    outputState[filename] = {
      ...existing,
      content,
      hasChanges: existing ? content !== existing.upstreamContent : false
    };
    FILES_SUBJECT.next({ ...outputState });
  }, []);

  return {
    state: outputState,
    updateLocalState,
    upstream: remoteState
  };
}
