import { Comment } from "@/db/schema";

export interface CommentWithUser extends Comment {
  user: {
    id: string;
    email: string;
  };
  replies?: CommentWithUser[];
}

export interface ThreadedComment extends CommentWithUser {
  replies: ThreadedComment[];
  depth: number;
}

export interface CommentPosition {
  x: number;
  y: number;
}

export interface CommentFormData {
  content: string;
  positionX: number;
  positionY: number;
  parentId?: string;
  isAnonymous?: boolean;
}

export interface CommentModeState {
  isEnabled: boolean;
  isAddingComment: boolean;
  pendingPosition: CommentPosition | null;
}

export interface CommentPanelState {
  isOpen: boolean;
  selectedCommentId: string | null;
  isEditing: boolean;
}

export interface CommentIndicatorProps {
  comment: CommentWithUser;
  isSelected: boolean;
  onClick: () => void;
  zoom: number;
  pan: { x: number; y: number };
  isPanning?: boolean;
  isPinching?: boolean;
  onDrag?: (position: CommentPosition) => void;
  onDragEnd?: (position: CommentPosition) => void;
  getContainerRect?: () => DOMRect | null;
  anonymousMode?: boolean;
}

export interface CommentFormProps {
  onSubmit: (data: CommentFormData) => void;
  onCancel: () => void;
  initialData?: Partial<CommentFormData>;
  isEditing?: boolean;
  loading?: boolean;
  placeholder?: string;
  anonymousMode?: boolean;
}

export interface CommentThreadProps {
  comment: CommentWithUser;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleResolved: () => void;
  onReply?: (parentId: string) => void;
  currentUserId?: string;
  depth?: number;
  anonymousMode?: boolean;
}

export interface CommentPanelProps {
  comments: Comment[];
  threadedComments: ThreadedComment[];
  selectedCommentId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectComment: (id: string) => void;
  onEditComment: (id: string, data: { content: string; positionX: number; positionY: number }) => Promise<void>;
  onDeleteComment: (id: string) => void;
  onToggleResolved: (id: string) => void;
  onCreateComment: (data: CommentFormData) => Promise<void>;
  currentUserId?: string;
  diagramId?: string;
  anonymousMode?: boolean;
}

export interface CommentOverlayProps {
  comments?: CommentWithUser[];
  threadedComments?: ThreadedComment[];
  selectedCommentId?: string | null;
  zoom: number;
  pan: { x: number; y: number };
  onCommentClick?: (commentId: string) => void;
  onDiagramClick?: (position: { x: number; y: number }) => void;
  isCommentMode?: boolean;
  diagramId?: string;
  isPanning?: boolean;
  isPinching?: boolean;
  onCreateComment?: (data: { content: string; positionX: number; positionY: number; isAnonymous?: boolean }) => Promise<void>;
  onPopupClick?: (commentId: string) => void;
  onUpdateCommentPosition?: (commentId: string, position: CommentPosition) => Promise<void>;
  anonymousMode?: boolean;
}

export interface UseCommentsOptions {
  diagramId: string;
  onCommentCreated?: (comment: CommentWithUser) => void;
  onCommentUpdated?: (comment: CommentWithUser) => void;
  onCommentDeleted?: (commentId: string) => void;
  onCommentResolved?: (commentId: string, isResolved: boolean) => void;
}

export interface UseCommentsReturn {
  comments: CommentWithUser[];
  threadedComments: ThreadedComment[];
  loading: boolean;
  error: string | null;
  createComment: (data: CommentFormData) => Promise<void>;
  updateComment: (commentId: string, data: Partial<CommentFormData> & { isResolved?: boolean }) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  toggleResolved: (commentId: string) => Promise<void>;
  refreshComments: () => Promise<void>;
}
