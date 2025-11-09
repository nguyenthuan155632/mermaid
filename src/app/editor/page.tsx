"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Box,
  Button,
  TextField,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  RadioGroup,
  FormControlLabel,
  Radio,
  Stack,
  useTheme,
  useMediaQuery,
  Drawer,
  Collapse,
  Chip,
  CircularProgress,
} from "@mui/material";
import {
  Save,
  GetApp,
  Share,
  AutoFixHigh,
  Menu as MenuIcon,
  LibraryBooks,
  Image as ImageIcon,
  Apps,
  Edit,
  Close,
  ChevronLeft,
  ChevronRight,
  UnfoldMore,
  Code,
  History,
  Restore,
  ExpandLess,
  ExpandMore,
} from "@mui/icons-material";
import SamplesSidebar from "@/components/SamplesSidebar";
import CodeEditor from "@/components/CodeEditor";
import MermaidRenderer from "@/components/MermaidRenderer";
import MarkdownEmbedDialog from "@/components/MarkdownEmbedDialog";
import { useDebounce } from "@/hooks/useDebounce";
import { exportToPNG, exportToSVG } from "@/lib/export";
import { DiagramSnapshot } from "@/types";

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

function EditorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [diagramId, setDiagramId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewSvg, setPreviewSvg] = useState<string>("");
  const [hasError, setHasError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [samplesOpen, setSamplesOpen] = useState(false);
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(true);
  const [leftDrawerWidth, setLeftDrawerWidth] = useState<"normal" | "wide" | "closed">("normal");
  const [pngDialogOpen, setPngDialogOpen] = useState(false);
  const [pngResolution, setPngResolution] = useState<number>(2);
  const [pngBackground, setPngBackground] = useState<'white' | 'transparent'>('white');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [codeDrawerOpen, setCodeDrawerOpen] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<DiagramSnapshot[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [revertingSnapshotId, setRevertingSnapshotId] = useState<string | null>(null);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [sidebarSections, setSidebarSections] = useState({
    samples: false,
    actions: false,
    history: false,
  });

  const debouncedCode = useDebounce(code, 300);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const historySectionOpen = isMobile ? true : sidebarSections.history;

  const fetchSnapshots = useCallback(async (targetId: string) => {
    setSnapshotsLoading(true);
    try {
      const response = await fetch(`/api/diagrams/${targetId}/snapshots`);
      if (!response.ok) {
        throw new Error("Failed to load version history");
      }
      const data: { items: DiagramSnapshot[] } = await response.json();
      setSnapshots(data.items ?? []);
    } catch (err) {
      console.error("Failed to fetch diagram snapshots", err);
    } finally {
      setSnapshotsLoading(false);
    }
  }, []);

  const toggleSection = (section: keyof typeof sidebarSections) => {
    setSidebarSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const diagramIdParam = searchParams.get("id");
  const freshParam = searchParams.get("fresh");
  const activeDiagramId = diagramId ?? diagramIdParam;

  // Generate preview SVG with transparent background option
  useEffect(() => {
    if (!debouncedCode || !pngDialogOpen) return;

    const generatePreview = async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        const id = `preview-${Date.now()}`;
        const { svg } = await mermaid.render(id, debouncedCode);

        // Remove white background if transparent is selected
        if (pngBackground === 'transparent') {
          const parser = new DOMParser();
          const svgDoc = parser.parseFromString(svg, 'image/svg+xml');
          const svgElement = svgDoc.querySelector('svg');

          if (svgElement) {
            // Remove white background rects
            const rects = svgElement.querySelectorAll('rect');
            rects.forEach((rect) => {
              const fill = rect.getAttribute('fill');
              const style = rect.getAttribute('style');
              if (
                fill && (
                  fill.toLowerCase() === '#ffffff' ||
                  fill.toLowerCase() === 'white' ||
                  fill.toLowerCase() === '#fff' ||
                  fill.toLowerCase().includes('rgb(255')
                )
              ) {
                const rectWidth = rect.getAttribute('width');
                if (rectWidth === '100%' || parseInt(rectWidth || '0') > 100) {
                  rect.remove();
                }
              }
              if (style && (style.includes('rgb(255, 255, 255)') || style.includes('#ffffff'))) {
                const rectWidth = rect.getAttribute('width');
                if (rectWidth === '100%' || parseInt(rectWidth || '0') > 100) {
                  rect.remove();
                }
              }
            });

            setPreviewSvg(new XMLSerializer().serializeToString(svgElement));
          }
        } else {
          setPreviewSvg(svg);
        }
      } catch (err) {
        console.error('Preview generation error:', err);
      }
    };

    generatePreview();
  }, [debouncedCode, pngBackground, pngDialogOpen]);

  // Delay editor mounting until drawer animation completes
  useEffect(() => {
    if (codeDrawerOpen && isMobile) {
      const timer = setTimeout(() => {
        setEditorReady(true);
      }, 350); // Slightly longer than transition (300ms)
      return () => clearTimeout(timer);
    } else {
      setEditorReady(false);
    }
  }, [codeDrawerOpen, isMobile]);

  useEffect(() => {
    const loadDraftFromStorage = () => {
      try {
        const savedCode = localStorage.getItem("mermaid-draft");
        if (savedCode) {
          setCode(savedCode);
        } else {
          setCode("");
        }
      } catch {
        setCode("");
      }
    };

    if (diagramIdParam) {
      fetch(`/api/diagrams/${diagramIdParam}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.id) {
            setDiagramId(data.id);
            setTitle(data.title);
            setCode(data.code);
            fetchSnapshots(data.id);
          } else {
            loadDraftFromStorage();
            setSnapshots([]);
          }
        })
        .catch(() => {
          loadDraftFromStorage();
          setSnapshots([]);
        });
      return;
    }

    if (freshParam === "1") {
      try {
        localStorage.removeItem("mermaid-draft");
      } catch {
        // ignore storage errors
      }
      setDiagramId(null);
      setTitle("");
      setCode("");
      setSnapshots([]);
      router.replace("/editor");
      return;
    }

    setSnapshots([]);
    loadDraftFromStorage();
  }, [diagramIdParam, freshParam, router, fetchSnapshots]);

  useEffect(() => {
    localStorage.setItem("mermaid-draft", code);
  }, [code]);

  useEffect(() => {
    if (!diagramId) {
      setHistoryDrawerOpen(false);
    }
  }, [diagramId]);

  useEffect(() => {
    setLeftDrawerOpen(!isMobile);
    if (!isMobile) {
      setMobileActionsOpen(false);
    }
  }, [isMobile]);

  const handleSave = async () => {
    if (!title.trim()) {
      alert("Please enter a title for your diagram");
      return;
    }

    setSaving(true);
    setSaveSuccess(false);
    try {
      const url = diagramId ? `/api/diagrams/${diagramId}` : "/api/diagrams";
      const method = diagramId ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          code,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save diagram");
      }

      const data = await response.json();
      if (!diagramId) {
        setDiagramId(data.id);
        // Update URL with the new diagram ID
        router.replace(`/editor?id=${data.id}`);
      }
      const nextDiagramId = diagramId ?? data.id;
      if (nextDiagramId) {
        await fetchSnapshots(nextDiagramId);
      }
      setSaveSuccess(true);
      alert("Diagram saved successfully!");

      // Reset success state after animation
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      alert("Failed to save diagram");
    } finally {
      setSaving(false);
    }
  };

  const handleRevertSnapshot = async (snapshotId: string) => {
    if (!diagramId) {
      return;
    }

    setRevertingSnapshotId(snapshotId);
    try {
      const response = await fetch(`/api/diagrams/${diagramId}/snapshots/${snapshotId}/revert`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to revert snapshot");
      }

      const data = await response.json();
      setTitle(data.title);
      setCode(data.code);
      setDiagramId(data.id);
      await fetchSnapshots(data.id);
      alert("Diagram reverted to the selected snapshot");
    } catch {
      alert("Failed to revert snapshot");
    } finally {
      setRevertingSnapshotId(null);
    }
  };

  const handleExportPNG = async () => {
    try {
      await exportToPNG(debouncedCode, title || "diagram", pngResolution, pngBackground);
      setPngDialogOpen(false);
    } catch {
      alert("Failed to export PNG");
    }
  };

  const handleExportSVG = async () => {
    try {
      await exportToSVG(debouncedCode, title || "diagram", 'white');
    } catch {
      alert("Failed to export SVG");
    }
  };

  const handleShare = async () => {
    if (!activeDiagramId) {
      alert("Please save the diagram first");
      return;
    }

    try {
      const response = await fetch(`/api/diagrams/${activeDiagramId}/share`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to generate share link");
      }

      const data = await response.json();
      const shareUrl = `${window.location.origin}/share/${data.shareToken}`;
      await navigator.clipboard.writeText(shareUrl);
      alert("Share link copied to clipboard!");
    } catch {
      alert("Failed to generate share link");
    }
  };

  const handleFixWithAI = async () => {
    if (!error) return;

    setFixing(true);
    try {
      const response = await fetch("/api/fix-diagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          error,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fix diagram");
      }

      const data = await response.json();
      setCode(data.fixedCode);
      alert(`Fixed! ${data.explanation}`);
    } catch {
      alert("Failed to fix diagram with AI");
    } finally {
      setFixing(false);
    }
  };

  const renderHistoryBody = () => {
    if (!diagramId) {
      return (
        <Typography variant="body2" color="text.secondary">
          Save the diagram to start tracking version history.
        </Typography>
      );
    }

    if (snapshotsLoading) {
      return (
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={16} thickness={5} />
          <Typography variant="body2" color="text.secondary">
            Loading history…
          </Typography>
        </Stack>
      );
    }

    if (snapshots.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary">
          Snapshots will appear here every time you save the diagram.
        </Typography>
      );
    }

    return (
      <Stack spacing={1.5} sx={{ mt: 1 }}>
        {snapshots.slice(0, 20).map((snapshot, index) => {
          const isCurrent = index === 0;
          return (
            <Box
              key={snapshot.id}
              sx={{
                border: "1px solid #e5e7eb",
                borderRadius: 1.5,
                p: 1.5,
                bgcolor: isCurrent ? "#f8fafc" : "white",
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    pr: 1,
                  }}
                >
                  {snapshot.title || "Untitled diagram"}
                </Typography>
                {isCurrent ? (
                  <Chip label="Current" size="small" color="success" variant="outlined" />
                ) : null}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {formatRelativeTime(snapshot.createdAt)} · {new Date(snapshot.createdAt).toLocaleString()}
              </Typography>
              {!isCurrent && (
                <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Restore fontSize="small" />}
                    onClick={() => handleRevertSnapshot(snapshot.id)}
                    disabled={revertingSnapshotId === snapshot.id}
                  >
                    {revertingSnapshotId === snapshot.id ? "Reverting..." : "Revert"}
                  </Button>
                </Box>
              )}
            </Box>
          );
        })}
      </Stack>
    );
  };

  const showSidebar = !isMobile && leftDrawerOpen;

  // Calculate sidebar width based on state
  const getSidebarWidth = () => {
    switch (leftDrawerWidth) {
      case "closed": return 0;
      case "normal": return 400;
      case "wide": return "50%";
      default: return 400;
    }
  };

  // Toggle through sidebar sizes: normal -> wide -> closed -> normal
  const toggleSidebarWidth = () => {
    if (leftDrawerWidth === "normal") {
      setLeftDrawerWidth("wide");
    } else if (leftDrawerWidth === "wide") {
      setLeftDrawerWidth("closed");
      setLeftDrawerOpen(false);
    } else {
      setLeftDrawerWidth("normal");
      setLeftDrawerOpen(true);
    }
  };

  // Get button position based on width
  const getButtonPosition = () => {
    if (leftDrawerWidth === "closed") return 0;
    if (leftDrawerWidth === "wide") return "calc(50% - 10px)";
    return 390;
  };

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", bgcolor: "#fafafa" }}>
      {/* Header */}
      <AppBar position="static" color="default" elevation={0} sx={{ bgcolor: "white", borderBottom: "1px solid #e5e7eb" }}>
        <Toolbar
          sx={{
            minHeight: { xs: 56, md: 64 },
            gap: isMobile ? 0.5 : 1,
            px: { xs: 1, md: 2 }
          }}
        >
          {!isMobile && (
            <IconButton edge="start" onClick={() => setLeftDrawerOpen(!leftDrawerOpen)} sx={{ mr: 2 }}>
              <MenuIcon />
            </IconButton>
          )}
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
              MermaidX
            </Typography>
          </Box>
          {isMobile ? (
            <>
              <IconButton onClick={() => setCodeDrawerOpen(true)} title="Edit Code" color="primary" size="small">
                <Edit fontSize="small" />
              </IconButton>
              <IconButton onClick={() => setSamplesOpen(true)} title="Browse Samples" color="primary" size="small">
                <Apps fontSize="small" />
              </IconButton>
              <IconButton onClick={() => router.push("/diagrams")} title="My Diagrams" color="primary" size="small">
                <LibraryBooks fontSize="small" />
              </IconButton>
              <IconButton
                onClick={() => setMobileActionsOpen((prev) => !prev)}
                title={mobileActionsOpen ? "Hide actions" : "More actions"}
                color="primary"
                size="small"
              >
                {mobileActionsOpen ? <Close fontSize="small" /> : <UnfoldMore fontSize="small" />}
              </IconButton>
            </>
          ) : (
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
            >
              <Button
                variant="text"
                startIcon={<LibraryBooks />}
                onClick={() => router.push("/diagrams")}
              >
                My Diagrams
              </Button>
              <Button
                variant="outlined"
                startIcon={<Share />}
                onClick={handleShare}
                disabled={!activeDiagramId}
                sx={{ mr: 1 }}
              >
                Share
              </Button>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSave}
                disabled={saving}
                sx={{
                  bgcolor: saveSuccess ? "success.main" : "primary.main",
                  color: "white",
                  position: "relative",
                  overflow: "hidden",
                  transition: "all 0.3s ease",
                  transform: saving ? "scale(0.95)" : "scale(1)",
                  "&:hover": {
                    bgcolor: saveSuccess ? "success.dark" : "primary.dark",
                    transform: "scale(1.05)",
                  },
                  "&:active": {
                    transform: "scale(0.95)",
                  },
                  "&::before": {
                    content: '""',
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: "0",
                    height: "0",
                    borderRadius: "50%",
                    background: "rgba(255, 255, 255, 0.5)",
                    transform: "translate(-50%, -50%)",
                    transition: "width 0.6s, height 0.6s",
                  },
                  "&:active::before": {
                    width: "300px",
                    height: "300px",
                  },
                  "@keyframes pulse": {
                    "0%": {
                      boxShadow: "0 0 0 0 rgba(25, 118, 210, 0.7)",
                    },
                    "70%": {
                      boxShadow: "0 0 0 10px rgba(25, 118, 210, 0)",
                    },
                    "100%": {
                      boxShadow: "0 0 0 0 rgba(25, 118, 210, 0)",
                    },
                  },
                  animation: saving ? "pulse 1.5s infinite" : "none",
                }}
              >
                {saving ? "Saving..." : saveSuccess ? "Saved!" : "Save diagram"}
              </Button>
            </Stack>
          )}
        </Toolbar>
        {isMobile && (
          <Collapse in={mobileActionsOpen}>
            <Stack
              spacing={1}
              sx={{
                px: 2,
                pt: 2,
                pb: 2,
                borderTop: "1px solid #e5e7eb",
                bgcolor: "white",
              }}
            >
              <Button
                variant="outlined"
                startIcon={<Share />}
                onClick={handleShare}
                disabled={!activeDiagramId}
                fullWidth
              >
                Share Diagram
              </Button>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  startIcon={<ImageIcon />}
                  onClick={() => setPngDialogOpen(true)}
                  fullWidth
                >
                  Export PNG
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<GetApp />}
                  onClick={handleExportSVG}
                  fullWidth
                >
                  Export SVG
                </Button>
              </Stack>
              <Button
                variant="outlined"
                startIcon={<Code />}
                onClick={() => setEmbedDialogOpen(true)}
                disabled={!activeDiagramId}
                fullWidth
              >
                Embed Options
              </Button>
              <Button
                variant="outlined"
                startIcon={<History />}
                onClick={() => setHistoryDrawerOpen(true)}
                disabled={!activeDiagramId}
                fullWidth
              >
                Version History
              </Button>
            </Stack>
          </Collapse>
        )}
      </AppBar>

      <Box sx={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        {/* Left Sidebar */}
        {showSidebar && (
          <Box
            sx={{
              width: getSidebarWidth(),
              flexShrink: 0,
              borderRight: leftDrawerWidth !== "closed" ? "1px solid #e5e7eb" : "none",
              display: "flex",
              flexDirection: "column",
              bgcolor: "white",
              transition: "width 0.3s ease",
              overflow: "hidden",
            }}
          >
            <Box sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              width: "100%",
              minWidth: leftDrawerWidth === "wide" ? 0 : 400
            }}>
              <Box sx={{ p: 2, borderBottom: "1px solid #e5e7eb" }}>
                <TextField
                  placeholder="Diagram Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  fullWidth
                  size="small"
                  variant="outlined"
                />
              </Box>
              <Box sx={{ flex: 1, overflow: "hidden" }}>
                <CodeEditor value={code} onChange={setCode} />
              </Box>
              <Divider />
              <Box sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Sample Diagrams
                  </Typography>
                  <IconButton size="small" onClick={() => toggleSection("samples")}
                    aria-label="Toggle sample diagrams section">
                    {sidebarSections.samples ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                  </IconButton>
                </Stack>
                <Collapse in={sidebarSections.samples} unmountOnExit>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => setSamplesOpen(true)}
                    size="small"
                  >
                    Browse Samples
                  </Button>
                </Collapse>
              </Box>
              <Divider />
              <Box sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Actions
                  </Typography>
                  <IconButton size="small" onClick={() => toggleSection("actions")} aria-label="Toggle actions section">
                    {sidebarSections.actions ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                  </IconButton>
                </Stack>
                <Collapse in={sidebarSections.actions} unmountOnExit>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <Button
                      variant="outlined"
                      startIcon={<GetApp />}
                      onClick={() => setPngDialogOpen(true)}
                      size="small"
                      fullWidth
                    >
                      Export PNG
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<GetApp />}
                      onClick={handleExportSVG}
                      size="small"
                      fullWidth
                    >
                      Export SVG
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<Code />}
                      onClick={() => setEmbedDialogOpen(true)}
                      size="small"
                      fullWidth
                    disabled={!activeDiagramId}
                    >
                      Embed
                    </Button>
                    {hasError && (
                      <Button
                        variant="outlined"
                        color="warning"
                        startIcon={<AutoFixHigh />}
                        onClick={handleFixWithAI}
                        disabled={fixing}
                        size="small"
                        fullWidth
                      >
                        {fixing ? "Fixing..." : "Fix with AI"}
                      </Button>
                    )}
                  </Box>
                </Collapse>
              </Box>
              <Divider />
              <Box sx={{ p: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <History fontSize="small" color="action" />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Version History
                    </Typography>
                  </Stack>
                  <IconButton size="small" onClick={() => toggleSection("history")} aria-label="Toggle version history section">
                    {sidebarSections.history ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                  </IconButton>
                </Stack>
                <Collapse in={historySectionOpen} unmountOnExit>
                  <Box sx={{ maxHeight: 260, overflowY: "auto", pr: 0.5 }}>
                    {renderHistoryBody()}
                  </Box>
                </Collapse>
              </Box>
            </Box>
          </Box>
        )}

        {/* Toggle Sidebar Button - Desktop Only */}
        {!isMobile && (
          <IconButton
            onClick={toggleSidebarWidth}
            title={
              leftDrawerWidth === "normal"
                ? "Expand to 50%"
                : leftDrawerWidth === "wide"
                  ? "Close editor"
                  : "Open editor"
            }
            sx={{
              position: "absolute",
              left: getButtonPosition(),
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 10,
              bgcolor: "primary.main",
              color: "white",
              width: 32,
              height: 64,
              borderRadius: "0 8px 8px 0",
              transition: "left 0.3s ease",
              "&:hover": {
                bgcolor: "primary.dark",
              },
              boxShadow: 2,
            }}
          >
            {leftDrawerWidth === "normal" ? (
              <UnfoldMore />
            ) : leftDrawerWidth === "wide" ? (
              <ChevronLeft />
            ) : (
              <ChevronRight />
            )}
          </IconButton>
        )}

        {/* Main Preview Area */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            bgcolor: "white",
          }}
        >
          <MermaidRenderer
            code={debouncedCode}
            onError={(err) => {
              setError(err);
              setHasError(true);
            }}
            onSuccess={() => {
              setHasError(false);
              setError(null);
            }}
          />
        </Box>
      </Box>

      <SamplesSidebar
        open={samplesOpen}
        onClose={() => setSamplesOpen(false)}
        onSelectSample={(code) => setCode(code)}
      />

      {/* Mobile History Drawer */}
      {isMobile && (
        <Drawer
          anchor="right"
          open={historyDrawerOpen}
          onClose={() => setHistoryDrawerOpen(false)}
          keepMounted
          PaperProps={{
            sx: {
              width: "85vw",
              maxWidth: 360,
              bgcolor: "#fafafa",
            },
          }}
        >
          <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <Box
              sx={{
                p: 2,
                display: "flex",
                alignItems: "center",
                gap: 1,
                borderBottom: "1px solid #e5e7eb",
                bgcolor: "white",
              }}
            >
              <History color="primary" />
              <Typography variant="h6" sx={{ flex: 1, fontWeight: 600 }}>
                Version History
              </Typography>
              <IconButton onClick={() => setHistoryDrawerOpen(false)} size="small">
                <Close />
              </IconButton>
            </Box>
            <Collapse in={historySectionOpen}>
              <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
                {renderHistoryBody()}
              </Box>
            </Collapse>
          </Box>
        </Drawer>
      )}

      {/* Mobile Code Editor Drawer */}
      {isMobile && (
        <Drawer
          anchor="bottom"
          open={codeDrawerOpen}
          onClose={() => setCodeDrawerOpen(false)}
          keepMounted
          PaperProps={{
            sx: {
              height: "50vh",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              bgcolor: "#fafafa",
            },
          }}
          transitionDuration={300}
        >
          <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <Box
              sx={{
                p: 2,
                display: "flex",
                alignItems: "center",
                gap: 2,
                bgcolor: "white",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <Edit sx={{ color: "primary.main", fontSize: 20 }} />
              <Typography
                variant="h6"
                sx={{
                  flex: 1,
                  fontWeight: 600,
                  fontSize: "1rem"
                }}
              >
                Edit Diagram
              </Typography>
              <IconButton onClick={() => setCodeDrawerOpen(false)} size="small">
                <Close />
              </IconButton>
            </Box>

            {/* Title Input */}
            <Box sx={{ p: 2, bgcolor: "white", borderBottom: "1px solid #e5e7eb" }}>
              <TextField
                placeholder="Diagram Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                fullWidth
                size="small"
                variant="outlined"
              />
            </Box>

            {/* Code Editor */}
            <Box sx={{
              flex: 1,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              {editorReady ? (
                <CodeEditor value={code} onChange={setCode} />
              ) : (
                <Typography color="text.secondary">Loading editor...</Typography>
              )}
            </Box>

            {/* Actions Footer */}
            <Box
              sx={{
                p: 2,
                bgcolor: "white",
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  fullWidth
                  variant="contained"
                  color={saveSuccess ? "success" : "primary"}
                  startIcon={<Save />}
                  onClick={handleSave}
                  disabled={saving}
                  size="small"
                >
                  {saving ? "Saving..." : saveSuccess ? "Saved!" : "Save"}
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => setSamplesOpen(true)}
                  size="small"
                >
                  Browse Samples
                </Button>
              </Box>
              {hasError && (
                <Button
                  fullWidth
                  variant="outlined"
                  color="warning"
                  startIcon={<AutoFixHigh />}
                  onClick={handleFixWithAI}
                  disabled={fixing}
                  size="small"
                >
                  {fixing ? "Fixing..." : "Fix with AI"}
                </Button>
              )}
            </Box>
          </Box>
        </Drawer>
      )}

      {/* Export Dialog */}
      <Dialog
        open={pngDialogOpen}
        onClose={() => setPngDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            height: '80vh',
          }
        }}
      >
        <DialogTitle sx={{
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: 600
        }}>
          Export diagram
          <IconButton onClick={() => setPngDialogOpen(false)} size="small">
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 0, display: 'flex', height: 'calc(100% - 120px)' }}>
          {/* Left Panel - Options */}
          <Box sx={{
            width: { xs: '100%', md: '400px' },
            p: 3,
            borderRight: { xs: 'none', md: '1px solid #e5e7eb' },
            overflowY: 'auto'
          }}>
            {/* Export Format */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Export format
              </Typography>
              <RadioGroup value="png">
                <Box sx={{
                  border: '2px solid',
                  borderColor: 'primary.main',
                  borderRadius: 2,
                  p: 2,
                  mb: 1.5,
                  bgcolor: 'primary.50'
                }}>
                  <FormControlLabel
                    value="png"
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="body1" fontWeight={600}>PNG</Typography>
                        <Typography variant="caption" color="text.secondary">
                          High quality raster image
                        </Typography>
                      </Box>
                    }
                  />
                </Box>
                <Box sx={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 2,
                  p: 2,
                  mb: 1.5
                }}>
                  <FormControlLabel
                    value="svg"
                    control={<Radio disabled />}
                    label={
                      <Box>
                        <Typography variant="body1" fontWeight={600}>SVG</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Scalable vector graphics
                        </Typography>
                      </Box>
                    }
                  />
                </Box>
              </RadioGroup>
            </Box>

            {/* Resolution */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Resolution
              </Typography>
              <RadioGroup
                value={pngResolution.toString()}
                onChange={(e) => setPngResolution(Number(e.target.value))}
              >
                {[
                  { value: '1', label: '1x - Standard', desc: 'Smallest file size' },
                  { value: '2', label: '2x - High Quality', desc: 'Recommended' },
                  { value: '3', label: '3x - Very High', desc: 'For presentations' },
                  { value: '4', label: '4x - Ultra', desc: 'Maximum quality' },
                ].map((option) => (
                  <FormControlLabel
                    key={option.value}
                    value={option.value}
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight={500}>{option.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.desc}
                        </Typography>
                      </Box>
                    }
                    sx={{ mb: 1 }}
                  />
                ))}
              </RadioGroup>
            </Box>

            {/* Background Color */}
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Background color
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <IconButton
                  onClick={() => setPngBackground('white')}
                  sx={{
                    width: 48,
                    height: 48,
                    border: '2px solid',
                    borderColor: pngBackground === 'white' ? 'primary.main' : '#e5e7eb',
                    borderRadius: 2,
                    bgcolor: 'white',
                    '&:hover': { bgcolor: '#f5f5f5' }
                  }}
                />
                <IconButton
                  onClick={() => setPngBackground('transparent')}
                  sx={{
                    width: 48,
                    height: 48,
                    border: '2px solid',
                    borderColor: pngBackground === 'transparent' ? 'primary.main' : '#e5e7eb',
                    borderRadius: 2,
                    bgcolor: 'white',
                    backgroundImage: 'linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%), linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%)',
                    backgroundSize: '10px 10px',
                    backgroundPosition: '0 0, 5px 5px',
                    '&:hover': { opacity: 0.8 }
                  }}
                />
              </Box>
            </Box>
          </Box>

          {/* Right Panel - Preview (hidden on mobile) */}
          <Box sx={{
            flex: 1,
            p: 3,
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Preview
              </Typography>
              {pngBackground === 'transparent' && (
                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  Note: Export will have transparent background
                </Typography>
              )}
            </Box>
            <Box sx={{
              flex: 1,
              border: '1px solid #e5e7eb',
              borderRadius: 2,
              p: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              ...(pngBackground === 'transparent'
                ? {
                  // Checkered pattern for transparent background
                  background: `
                      linear-gradient(45deg, #ccc 25%, transparent 25%),
                      linear-gradient(-45deg, #ccc 25%, transparent 25%),
                      linear-gradient(45deg, transparent 75%, #ccc 75%),
                      linear-gradient(-45deg, transparent 75%, #ccc 75%)
                    `,
                  backgroundSize: '20px 20px',
                  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                  bgcolor: '#fff'
                }
                : {
                  // Solid white background
                  bgcolor: 'white',
                  backgroundImage: 'none'
                }
              ),
              overflow: 'auto'
            }}>
              {previewSvg ? (
                <Box
                  dangerouslySetInnerHTML={{ __html: previewSvg }}
                  sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    '& svg': {
                      maxWidth: '95%',
                      maxHeight: '95%',
                      width: 'auto',
                      height: 'auto',
                      display: 'block'
                    }
                  }}
                />
              ) : (
                <MermaidRenderer
                  code={debouncedCode}
                  onError={() => { }}
                  onSuccess={() => { }}
                  disableInteractions={true}
                />
              )}
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{
          px: 3,
          py: 2,
          borderTop: '1px solid #e5e7eb',
          gap: 1
        }}>
          <Button
            onClick={() => setPngDialogOpen(false)}
            variant="outlined"
            size="large"
          >
            Cancel
          </Button>
          <Button
            onClick={handleExportPNG}
            variant="contained"
            size="large"
          >
            Export
          </Button>
        </DialogActions>
      </Dialog>

      {/* Markdown Embed Dialog */}
      {diagramId && (
        <MarkdownEmbedDialog
          open={embedDialogOpen}
          onClose={() => setEmbedDialogOpen(false)}
          diagramId={diagramId}
          diagramTitle={title || "diagram"}
          baseUrl={window.location.origin}
        />
      )}
    </Box >
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={<Box sx={{ p: 3 }}><Typography>Loading...</Typography></Box>}>
      <EditorContent />
    </Suspense>
  );
}
