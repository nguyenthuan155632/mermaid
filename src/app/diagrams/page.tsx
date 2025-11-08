"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Container,
  Stack,
  TextField,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  MenuItem,
  Chip,
  CircularProgress,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  AlertColor,
  LinearProgress,
  Divider,
  Tooltip,
} from "@mui/material";
import {
  Edit,
  Delete,
  Share,
  Add,
  Home,
  Logout,
  GridView,
  ViewList,
  Search as SearchIcon,
  ContentCopy,
  Visibility,
  Refresh,
  Close,
  Save,
} from "@mui/icons-material";
import { useSession, signOut } from "next-auth/react";
import MermaidRenderer from "@/components/MermaidRenderer";
import { Diagram } from "@/types";
import { useDebounce } from "@/hooks/useDebounce";

type SortKey = "title" | "createdAt" | "updatedAt";
type ViewMode = "grid" | "list";
type VisibilityFilter = "all" | "public" | "private";

interface PaginatedResponse {
  items: Diagram[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "updatedAt", label: "Last modified" },
  { value: "createdAt", label: "Date created" },
  { value: "title", label: "Title" },
];

const PAGE_SIZE_OPTIONS = [6, 9, 12, 18, 24];

const formatDate = (value: string | Date) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatRelativeTime = (value: string | Date) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

export default function DiagramsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [visibility, setVisibility] = useState<VisibilityFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: AlertColor;
  }>({ open: false, message: "", severity: "success" });
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    diagram: Diagram | null;
  }>({ open: false, diagram: null });
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    diagram: Diagram | null;
    title: string;
    description: string;
  }>({ open: false, diagram: null, title: "", description: "" });
  const [shareTarget, setShareTarget] = useState<string | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<string | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const debouncedSearch = useDebounce(search, 400);

  const handleSnackbar = (message: string, severity: AlertColor = "success") =>
    setSnackbar({ open: true, message, severity });

  const fetchDiagrams = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy,
        sortDir,
      });

      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }
      if (visibility !== "all") {
        params.set("visibility", visibility);
      }
      if (dateFrom) {
        params.set("from", dateFrom);
      }
      if (dateTo) {
        params.set("to", dateTo);
      }

      const response = await fetch(`/api/diagrams?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to load diagrams");
      }
      const data: PaginatedResponse = await response.json();
      setDiagrams(data.items);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
      if (data.pagination.page !== page) {
        setPage(data.pagination.page);
      }
      if (data.pagination.pageSize !== pageSize) {
        setPageSize(data.pagination.pageSize);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load diagrams");
    } finally {
      setLoading(false);
    }
  }, [
    session?.user?.id,
    page,
    pageSize,
    sortBy,
    sortDir,
    debouncedSearch,
    visibility,
    dateFrom,
    dateTo,
  ]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchDiagrams();
    }
  }, [session?.user?.id, fetchDiagrams]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  const handleView = (diagramId: string) => {
    router.push(`/editor?id=${diagramId}`);
  };

  const handleEdit = (diagram: Diagram) => {
    setEditDialog({
      open: true,
      diagram,
      title: diagram.title,
      description: diagram.description ?? "",
    });
  };

  const handleEditSubmit = async () => {
    if (!editDialog.diagram) return;
    if (!editDialog.title.trim()) {
      handleSnackbar("Title is required", "error");
      return;
    }
    setEditSaving(true);
    try {
      const response = await fetch(`/api/diagrams/${editDialog.diagram.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editDialog.title.trim(),
          description: editDialog.description.trim() || null,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to update diagram");
      }
      await fetchDiagrams();
      handleSnackbar("Diagram updated");
      setEditDialog({ open: false, diagram: null, title: "", description: "" });
    } catch (err) {
      handleSnackbar(
        err instanceof Error ? err.message : "Failed to update diagram",
        "error"
      );
    } finally {
      setEditSaving(false);
    }
  };

  const handleShare = async (diagramId: string) => {
    setShareTarget(diagramId);
    try {
      const response = await fetch(`/api/diagrams/${diagramId}/share`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to generate share link");
      }
      const data = await response.json();
      const shareUrl = `${window.location.origin}/share/${data.shareToken}`;
      await navigator.clipboard.writeText(shareUrl);
      handleSnackbar("Share link copied to clipboard");
    } catch (err) {
      handleSnackbar(
        err instanceof Error ? err.message : "Failed to share diagram",
        "error"
      );
    } finally {
      setShareTarget(null);
    }
  };

  const handleDuplicate = async (diagramId: string) => {
    setDuplicateTarget(diagramId);
    try {
      const response = await fetch(`/api/diagrams/${diagramId}/duplicate`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to duplicate diagram");
      }
      await fetchDiagrams();
      handleSnackbar("Diagram duplicated");
    } catch (err) {
      handleSnackbar(
        err instanceof Error ? err.message : "Failed to duplicate diagram",
        "error"
      );
    } finally {
      setDuplicateTarget(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.diagram) return;
    setDeleteInProgress(true);
    try {
      const response = await fetch(`/api/diagrams/${deleteDialog.diagram.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete diagram");
      }
      await fetchDiagrams();
      handleSnackbar("Diagram deleted");
      setDeleteDialog({ open: false, diagram: null });
    } catch (err) {
      handleSnackbar(
        err instanceof Error ? err.message : "Failed to delete diagram",
        "error"
      );
    } finally {
      setDeleteInProgress(false);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setVisibility("all");
    setDateFrom("");
    setDateTo("");
    setSortBy("updatedAt");
    setSortDir("desc");
    setPage(1);
  };

  const emptyState = !loading && diagrams.length === 0;

  const paginationLabel = useMemo(() => {
    if (total === 0) return "No diagrams yet";
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(start + diagrams.length - 1, total);
    return `Showing ${start}-${end} of ${total}`;
  }, [page, pageSize, diagrams.length, total]);

  if (status === "loading") {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (status !== "authenticated") {
    return null;
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: (theme) => theme.palette.grey[50] }}>
      <AppBar position="sticky" elevation={0} color="default" sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
            Diagram Library
          </Typography>
          <IconButton color="inherit" onClick={() => router.push("/")}>
            <Home />
          </IconButton>
          <Button color="inherit" onClick={() => router.push("/editor")}>
            Editor
          </Button>
          <Button color="inherit" startIcon={<Add />} onClick={() => router.push("/editor?fresh=1")}>
            New Diagram
          </Button>
          <Button color="inherit" onClick={() => signOut()}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      {loading && <LinearProgress color="primary" />}

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", gap: 2 }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                Saved Diagrams
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Browse, search, and manage everything you have created.
              </Typography>
            </Box>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, value) => value && setViewMode(value)}
              size="small"
            >
              <ToggleButton value="grid" aria-label="grid view">
                <GridView fontSize="small" />
              </ToggleButton>
              <ToggleButton value="list" aria-label="list view">
                <ViewList fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={2}
                  alignItems={{ xs: "stretch", md: "center" }}
                >
                  <TextField
                    label="Search diagrams"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    fullWidth
                    size="small"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <TextField
                    select
                    size="small"
                    label="Sort by"
                    value={sortBy}
                    sx={{ minWidth: 160 }}
                    onChange={(event) => {
                      setSortBy(event.target.value as SortKey);
                      setPage(1);
                    }}
                  >
                    {SORT_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <ToggleButtonGroup
                    value={sortDir}
                    exclusive
                    onChange={(_, value) => {
                      if (!value) return;
                      setSortDir(value);
                    }}
                    size="small"
                    aria-label="sort direction"
                  >
                    <ToggleButton value="asc">Asc</ToggleButton>
                    <ToggleButton value="desc">Desc</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>

                <Divider />

                <Stack
                  direction={{ xs: "column", lg: "row" }}
                  spacing={2}
                  alignItems={{ xs: "stretch", lg: "center" }}
                >
                  <ToggleButtonGroup
                    value={visibility}
                    exclusive
                    onChange={(_, value) => {
                      if (!value) return;
                      setVisibility(value);
                      setPage(1);
                    }}
                    size="small"
                  >
                    <ToggleButton value="all">All</ToggleButton>
                    <ToggleButton value="private">Private</ToggleButton>
                    <ToggleButton value="public">Public</ToggleButton>
                  </ToggleButtonGroup>
                  <TextField
                    label="Created from"
                    type="date"
                    size="small"
                    value={dateFrom}
                    onChange={(event) => {
                      setDateFrom(event.target.value);
                      setPage(1);
                    }}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label="Created to"
                    type="date"
                    size="small"
                    value={dateTo}
                    onChange={(event) => {
                      setDateTo(event.target.value);
                      setPage(1);
                    }}
                    InputLabelProps={{ shrink: true }}
                  />
                  <Box sx={{ flexGrow: 1 }} />
                  <Button
                    variant="text"
                    startIcon={<Refresh />}
                    onClick={resetFilters}
                  >
                    Reset filters
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          {error && (
            <Alert severity="error">
              {error}
            </Alert>
          )}

          {emptyState ? (
            <Card sx={{ textAlign: "center", py: 8 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  No diagrams found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Save your first diagram from the editor or adjust the filters above.
                </Typography>
                <Button variant="contained" startIcon={<Add />} onClick={() => router.push("/editor?fresh=1")}>
                  Create a diagram
                </Button>
              </CardContent>
            </Card>
          ) : viewMode === "grid" ? (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "repeat(1, minmax(0, 1fr))",
                  sm: "repeat(2, minmax(0, 1fr))",
                  md: "repeat(3, minmax(0, 1fr))",
                },
                gap: 3,
              }}
            >
              {diagrams.map((diagram) => (
                <Card key={diagram.id} sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                  <Box sx={{ height: 220, borderBottom: 1, borderColor: "divider", p: 1, bgcolor: "grey.100" }}>
                    <MermaidRenderer code={diagram.code} disableInteractions initialZoom={0.5} />
                  </Box>
                  <CardContent sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        {diagram.title}
                      </Typography>
                      <Chip
                        size="small"
                        color={diagram.isPublic ? "success" : "default"}
                        label={diagram.isPublic ? "Public" : "Private"}
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ minHeight: 48 }}>
                      {diagram.description || "No description provided."}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Chip size="small" label={`Updated ${formatRelativeTime(diagram.updatedAt)}`} />
                      <Chip size="small" variant="outlined" label={`Created ${formatDate(diagram.createdAt)}`} />
                    </Stack>
                  </CardContent>
                  <CardActions sx={{ justifyContent: "space-between", px: 2, pb: 2 }}>
                    <Stack direction="row" spacing={1}>
                      <Tooltip title="View in editor">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleView(diagram.id)}
                            aria-label="View diagram"
                          >
                            <Visibility fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Edit details">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleEdit(diagram)}
                            aria-label="Edit diagram"
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={duplicateTarget === diagram.id ? "Duplicating..." : "Duplicate"}>
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleDuplicate(diagram.id)}
                            aria-label="Duplicate diagram"
                            disabled={duplicateTarget === diagram.id}
                          >
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={shareTarget === diagram.id ? "Sharing..." : "Copy share link"}>
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleShare(diagram.id)}
                            aria-label="Share diagram"
                            disabled={shareTarget === diagram.id}
                          >
                            <Share fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                    <Tooltip title="Delete diagram">
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setDeleteDialog({ open: true, diagram })}
                          aria-label="Delete diagram"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </CardActions>
                </Card>
              ))}
            </Box>
          ) : (
            <Stack spacing={3}>
              {diagrams.map((diagram) => (
                <Card key={diagram.id}>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <Box sx={{ flexBasis: { md: "35%" }, flexShrink: 0, borderRight: { md: 1 }, borderBottom: { xs: 1, md: 0 }, borderColor: "divider", p: 1, bgcolor: "grey.100" }}>
                      <Box sx={{ height: 240 }}>
                        <MermaidRenderer code={diagram.code} disableInteractions initialZoom={0.5} />
                      </Box>
                    </Box>
                    <Box sx={{ flex: 1, py: 2, pr: 2 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="h6" sx={{ flexGrow: 1 }}>
                          {diagram.title}
                        </Typography>
                        <Chip
                          size="small"
                          color={diagram.isPublic ? "success" : "default"}
                          label={diagram.isPublic ? "Public" : "Private"}
                        />
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
                        {diagram.description || "No description provided."}
                      </Typography>
                      <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Created: <strong>{formatDate(diagram.createdAt)}</strong>
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Updated: <strong>{formatRelativeTime(diagram.updatedAt)}</strong>
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Tooltip title="View in editor">
                          <span>
                            <IconButton
                              onClick={() => handleView(diagram.id)}
                              aria-label="View diagram"
                              size="small"
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Edit details">
                          <span>
                            <IconButton
                              onClick={() => handleEdit(diagram)}
                              aria-label="Edit diagram"
                              size="small"
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={duplicateTarget === diagram.id ? "Duplicating..." : "Duplicate"}>
                          <span>
                            <IconButton
                              onClick={() => handleDuplicate(diagram.id)}
                              aria-label="Duplicate diagram"
                              size="small"
                              disabled={duplicateTarget === diagram.id}
                            >
                              <ContentCopy fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={shareTarget === diagram.id ? "Sharing..." : "Copy share link"}>
                          <span>
                            <IconButton
                              onClick={() => handleShare(diagram.id)}
                              aria-label="Share diagram"
                              size="small"
                              disabled={shareTarget === diagram.id}
                            >
                              <Share fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Delete diagram">
                          <span>
                            <IconButton
                              onClick={() => setDeleteDialog({ open: true, diagram })}
                              aria-label="Delete diagram"
                              color="error"
                              size="small"
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </Box>
                  </Stack>
                </Card>
              ))}
            </Stack>
          )}

          {totalPages > 1 && (
            <Card>
              <CardContent sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", gap: 2 }}>
                <Pagination
                  page={page}
                  count={totalPages}
                  color="primary"
                  onChange={(_, value) => setPage(value)}
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "flex-start", sm: "center" }}>
                  <TextField
                    select
                    size="small"
                    label="Per page"
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setPage(1);
                    }}
                    sx={{ width: 140 }}
                  >
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Typography variant="body2" color="text.secondary">
                    {paginationLabel}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          )}
        </Stack>
      </Container>

      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, diagram: null })}
      >
        <DialogTitle>Delete diagram?</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            {`"${deleteDialog.diagram?.title ?? "This diagram"}" will be permanently removed.`}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialog({ open: false, diagram: null })}
            disabled={deleteInProgress}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={deleteInProgress}
          >
            {deleteInProgress ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={editDialog.open}
        onClose={() =>
          setEditDialog({ open: false, diagram: null, title: "", description: "" })
        }
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            mt: { xs: 2, sm: 6 },
          },
        }}
      >
        <DialogTitle sx={{ pb: 0 }}>
          <Box sx={{ pr: 5 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Edit diagram details
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Update the title or description shown across your workspace.
            </Typography>
          </Box>
          <IconButton
            onClick={() =>
              setEditDialog({ open: false, diagram: null, title: "", description: "" })
            }
            sx={{ position: "absolute", top: 8, right: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 0, mt: 1 }}>
          <Stack spacing={3}>
            {editDialog.diagram && (
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                alignItems={{ xs: "flex-start", sm: "center" }}
                sx={{ mt: 1 }}
              >
                <Chip
                  size="small"
                  label={`Updated ${formatRelativeTime(editDialog.diagram.updatedAt)}`}
                />
                <Typography variant="body2" color="text.secondary">
                  Created {formatDate(editDialog.diagram.createdAt)}
                </Typography>
              </Stack>
            )}
            <Divider />
            <TextField
              label="Title"
              value={editDialog.title}
              onChange={(event) =>
                setEditDialog((prev) => ({ ...prev, title: event.target.value }))
              }
              fullWidth
              autoFocus
              helperText="Use a clear, descriptive name so teammates can find it quickly."
            />
            <TextField
              label="Description"
              value={editDialog.description}
              onChange={(event) =>
                setEditDialog((prev) => ({ ...prev, description: event.target.value }))
              }
              fullWidth
              multiline
              minRows={4}
              placeholder="Add a short summary of what this diagram covers."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() =>
              setEditDialog({ open: false, diagram: null, title: "", description: "" })
            }
            disabled={editSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleEditSubmit}
            variant="contained"
            disabled={editSaving}
            startIcon={editSaving ? <CircularProgress size={16} /> : <Save />}
          >
            {editSaving ? "Saving" : "Save changes"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
