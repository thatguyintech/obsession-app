import { useCallback, useState, type DragEvent, type ReactNode } from "react";

interface UseListReorderOptions {
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export function useListReorder({ onReorder }: UseListReorderOptions) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number, event: DragEvent) => {
    setDraggingIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingIndex(null);
    setDropTargetIndex(null);
  }, []);

  const handleDragOver = useCallback((index: number, event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetIndex(index);
  }, []);

  const handleDrop = useCallback(
    (index: number, event: DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData("text/plain");
      const fromIndex = Number(raw);
      if (Number.isFinite(fromIndex) && fromIndex !== index) {
        onReorder(fromIndex, index);
      }
      setDraggingIndex(null);
      setDropTargetIndex(null);
    },
    [onReorder],
  );

  return {
    draggingIndex,
    dropTargetIndex,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
  };
}

interface DragHandleProps {
  label: string;
  draggable?: boolean;
  onDragStart?: (event: DragEvent) => void;
  onDragEnd?: () => void;
}

export function DragHandle({
  label,
  draggable = true,
  onDragStart,
  onDragEnd,
}: DragHandleProps) {
  return (
    <button
      type="button"
      draggable={draggable}
      aria-label={label}
      title={label}
      className="qa-drag-handle shrink-0 cursor-grab active:cursor-grabbing"
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      ⋮⋮
    </button>
  );
}

interface ReorderableRowProps {
  index: number;
  isDragging: boolean;
  isDropTarget: boolean;
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
  dragHandle: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ReorderableRow({
  index,
  isDragging,
  isDropTarget,
  onDragOver,
  onDrop,
  dragHandle,
  children,
  className = "",
}: ReorderableRowProps) {
  return (
    <div
      data-reorder-index={index}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`qa-reorder-row ${isDragging ? "qa-reorder-row-dragging" : ""} ${
        isDropTarget ? "qa-reorder-row-target" : ""
      } ${className}`.trim()}
    >
      {dragHandle}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
