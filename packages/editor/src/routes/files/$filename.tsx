import { createFileRoute } from '@tanstack/react-router';

import { resolveEditorWidgetForFilename } from '../../components/file-editors/resolve-editor-widget-for-filename';

export const Route = createFileRoute('/files/$filename')({
  component: FileEditor,
  ssr: false
});

function FileEditor() {
  const { filename } = Route.useParams();
  const FileEditorWidget = resolveEditorWidgetForFilename(filename);
  return <FileEditorWidget filename={filename} />;
}
