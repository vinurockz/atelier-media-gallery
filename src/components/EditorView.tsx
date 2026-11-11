import { useEffect, useState } from "react";
import type { MediaItem } from "@/types/media";
import type { EditorSession } from "@/types/editorSession";
import { useEditorSessions } from "@/hooks/useEditorSessions";
import { AttachMediaModal } from "@/components/AttachMediaModal";
import { EditorSessionBlock } from "@/components/EditorSessionBlock";
import { ImageEditor } from "@/components/ImageEditor";
import { VideoEditor } from "@/components/VideoEditor";
import { ScissorsIcon } from "@/components/icons";

interface EditorViewProps {
  mediaItems: MediaItem[];
  onSave: (item: MediaItem, file: File) => Promise<MediaItem | null>;
  /** Reports whether a photo/video is currently open for editing. */
  onEditingChange: (editing: boolean) => void;
}

/** Entry point for the Editor module: an Images block and a Videos block, each with its
 * own history of draft/completed edit sessions (see useEditorSessions) — pick one to
 * resume it, or start a new edit. */
export function EditorView({
  mediaItems,
  onSave,
  onEditingChange,
}: EditorViewProps) {
  const { sessions, startDraft, completeSession, deleteSession } =
    useEditorSessions();
  const [source, setSource] = useState<MediaItem | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [pickerType, setPickerType] = useState<"image" | "video" | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    onEditingChange(source !== null);
    return () => onEditingChange(false);
  }, [source, onEditingChange]);

  const openNewEdit = (item: MediaItem) => {
    // AttachMediaModal's picker already restricts to image/video; this is
    // just the type guard startDraft needs — a PDF never reaches here.
    if (item.type === "pdf") return;
    const sessionId = startDraft(item.type, item.id);
    setActiveSessionId(sessionId);
    setSource(item);
    setSavedMessage(null);
  };

  const resumeSession = (session: EditorSession) => {
    const item = mediaItems.find((m) => m.id === session.sourceItemId);
    if (!item || item.type === "pdf") return;
    if (session.status === "draft") {
      setActiveSessionId(session.id);
    } else {
      // Editing a completed session again starts a fresh draft — the finished one
      // stays in history as-is.
      setActiveSessionId(startDraft(item.type, item.id));
    }
    setSource(item);
    setSavedMessage(null);
  };

  const handleSave = async (file: File) => {
    if (!source) return;
    const result = await onSave(source, file);
    if (activeSessionId && result) completeSession(activeSessionId, result.id);
    setSavedMessage(`Saved "${file.name}" to your file manager.`);
    setSource(null);
    setActiveSessionId(null);
  };

  const handleCancel = () => {
    // The draft session stays in history — only closing out of the editor, not
    // discarding the record that you started editing this item.
    setSource(null);
    setActiveSessionId(null);
  };

  if (source) {
    return source.type === "image" ? (
      <ImageEditor
        item={source}
        mediaItems={mediaItems}
        onSave={handleSave}
        onSaveSelection={(file) => onSave(source, file)}
        onCancel={handleCancel}
      />
    ) : (
      <VideoEditor item={source} onSave={handleSave} onCancel={handleCancel} />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-linen bg-white px-4 py-3 sm:px-6">
        <ScissorsIcon className="size-4 text-stone" />
        <h1 className="text-base font-medium text-ink">Editor</h1>
      </div>

      <div className="flex-1 space-y-8 overflow-y-auto bg-canvas px-4 py-6 sm:px-6">
        {savedMessage && (
          <p className="rounded-lg bg-accent/10 px-4 py-2 text-sm font-medium text-accent">
            {savedMessage}
          </p>
        )}
        <p className="text-sm text-stone">
          Edits are always saved as a brand-new file — the original in your file
          manager is never touched.
        </p>

        <EditorSessionBlock
          title="Images"
          mediaType="image"
          sessions={sessions.filter((s) => s.mediaType === "image")}
          mediaItems={mediaItems}
          onNew={() => setPickerType("image")}
          onResume={resumeSession}
          onDelete={deleteSession}
        />
        <EditorSessionBlock
          title="Videos"
          mediaType="video"
          sessions={sessions.filter((s) => s.mediaType === "video")}
          mediaItems={mediaItems}
          onNew={() => setPickerType("video")}
          onResume={resumeSession}
          onDelete={deleteSession}
        />
      </div>

      {pickerType && (
        <AttachMediaModal
          items={mediaItems}
          typeFilter={pickerType}
          multiple={false}
          title={
            pickerType === "image"
              ? "Pick a picture to edit"
              : "Pick a video to edit"
          }
          onClose={() => setPickerType(null)}
          onConfirm={(ids) => {
            const item = mediaItems.find((i) => i.id === ids[0]);
            if (item) openNewEdit(item);
            setPickerType(null);
          }}
        />
      )}
    </div>
  );
}
