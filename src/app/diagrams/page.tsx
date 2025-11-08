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
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: "white", borderBottom: "1px solid #e5e7eb" }}>
        <Toolbar sx={{ minHeight: { xs: 56, md: 64 }, gap: { xs: 0.5, md: 1 }, px: { xs: 1, md: 2 } }}>
          <Box sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            flexGrow: 1,
            minWidth: 0
          }}>
            <Box
              component="svg"
              sx={{ width: { xs: 28, md: 32 }, height: { xs: 28, md: 32 }, flexShrink: 0 }}
              viewBox="0 0 100 100"
            >
              <rect fill="#FF2E88" width="100" height="100" rx="10" />
              <text
                x="50"
                y="70"
                fontSize="60"
                fill="white"
                textAnchor="middle"
                fontWeight="bold"
              >
                M
              </text>
            </Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                color: "text.primary",
                fontSize: { xs: "0.95rem", md: "1.25rem" },
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              Mermaid Live Editor
            </Typography>
          </Box>
          <Stack direction="row" spacing={{ xs: 0.5, md: 1 }} alignItems="center">
            <IconButton onClick={() => router.push("/")} size="small" title="Home" color="default">
              <Home />
            </IconButton>
            <Button
              variant="contained"
              color="primary"
              startIcon={<Add />}
              onClick={() => router.push("/editor?fresh=1")}
              size="small"
            >
              New
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={() => signOut()}
              size="small"
            >
              Logout
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      {loading && <LinearProgress color="primary" />}

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Diagrams
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Browse, search, and manage everything you have created.
            </Typography>
          </Box>

          <Card elevation={0} sx={{ border: "1px solid #e5e7eb" }}>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Stack spacing={2.5}>
                {/* Search and Sort Row */}
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  alignItems={{ xs: "stretch", sm: "center" }}
                >
                  <TextField
                    placeholder="Search diagrams"
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
                    sx={{ maxWidth: { sm: 400 } }}
                  />
                  <TextField
                    select
                    size="small"
                    label="Sort by"
                    value={sortBy}
                    sx={{ minWidth: { xs: "100%", sm: 160 } }}
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
                      setPage(1);
                    }}
                    size="small"
                    aria-label="sort direction"
                    sx={{ width: { xs: "100%", sm: "auto" } }}
                  >
                    <ToggleButton value="asc" sx={{ flex: { xs: 1, sm: "initial" } }}>ASC</ToggleButton>
                    <ToggleButton value="desc" sx={{ flex: { xs: 1, sm: "initial" } }}>DESC</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>

                <Divider />

                {/* Filter Row */}
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={2}
                  alignItems={{ xs: "stretch", md: "center" }}
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
                    sx={{ width: { xs: "100%", md: "auto" } }}
                  >
                    <ToggleButton value="all" sx={{ flex: { xs: 1, md: "initial" } }}>ALL</ToggleButton>
                    <ToggleButton value="private" sx={{ flex: { xs: 1, md: "initial" } }}>PRIVATE</ToggleButton>
                    <ToggleButton value="public" sx={{ flex: { xs: 1, md: "initial" } }}>PUBLIC</ToggleButton>
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
                    sx={{ flex: { xs: 1, md: "initial" }, minWidth: { md: 160 } }}
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
                    sx={{ flex: { xs: 1, md: "initial" }, minWidth: { md: 160 } }}
                  />
                  <Box sx={{ flexGrow: 1, display: { xs: "none", md: "block" } }} />
                  <Button
                    variant="text"
                    color="primary"
                    startIcon={<Refresh />}
                    onClick={resetFilters}
                    size="small"
                    sx={{ width: { xs: "100%", md: "auto" } }}
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
          ) : (
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
