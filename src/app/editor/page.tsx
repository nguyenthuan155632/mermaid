"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
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
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Stack,
  useTheme,
  useMediaQuery,
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
} from "@mui/icons-material";
import SamplesSidebar from "@/components/SamplesSidebar";
import CodeEditor from "@/components/CodeEditor";
import MermaidRenderer from "@/components/MermaidRenderer";
import { useSession, signOut } from "next-auth/react";
import { useDebounce } from "@/hooks/useDebounce";
import { exportToPNG, exportToSVG } from "@/lib/export";

function EditorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [diagramId, setDiagramId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [samplesOpen, setSamplesOpen] = useState(false);
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(true);
  const [pngDialogOpen, setPngDialogOpen] = useState(false);
  const [pngResolution, setPngResolution] = useState<number>(2);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const debouncedCode = useDebounce(code, 300);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const diagramIdParam = searchParams.get("id");
  const freshParam = searchParams.get("fresh");

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
          } else {
            loadDraftFromStorage();
          }
        })
        .catch(loadDraftFromStorage);
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
      router.replace("/editor");
      return;
    }

    loadDraftFromStorage();
  }, [diagramIdParam, freshParam, router]);

  useEffect(() => {
    localStorage.setItem("mermaid-draft", code);
  }, [code]);

  useEffect(() => {
    setLeftDrawerOpen(!isMobile);
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
          code: debouncedCode,
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
      setSaveSuccess(true);
      alert("Diagram saved successfully!");

      // Reset success state after animation
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      alert("Failed to save diagram");
    } finally {
      setSaving(false);
    }
  };

  const handleExportPNG = async () => {
    try {
      await exportToPNG(debouncedCode, title || "diagram", pngResolution);
      setPngDialogOpen(false);
    } catch (err) {
      alert("Failed to export PNG");
    }
  };

  const handleExportSVG = async () => {
    try {
      await exportToSVG(debouncedCode, title || "diagram");
    } catch (err) {
      alert("Failed to export SVG");
    }
  };

  const handleShare = async () => {
    if (!diagramId) {
      alert("Please save the diagram first");
      return;
    }

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
      alert("Share link copied to clipboard!");
    } catch (err) {
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
    } catch (err) {
      alert("Failed to fix diagram with AI");
    } finally {
      setFixing(false);
    }
  };

  const showSidebar = !isMobile && leftDrawerOpen;

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
              Mermaid Live Editor
            </Typography>
          </Box>
          {isMobile ? (
            <>
              <IconButton onClick={() => setSamplesOpen(true)} title="Browse Samples" color="primary" size="small">
                <Apps fontSize="small" />
              </IconButton>
              <IconButton onClick={() => router.push("/diagrams")} title="My Diagrams" color="primary" size="small">
                <LibraryBooks fontSize="small" />
              </IconButton>
              <IconButton onClick={handleShare} title="Share" color="primary" size="small" disabled={!diagramId}>
                <Share fontSize="small" />
              </IconButton>
              <IconButton onClick={() => setPngDialogOpen(true)} title="Export PNG" color="primary" size="small">
                <ImageIcon fontSize="small" />
              </IconButton>
              <IconButton onClick={handleExportSVG} title="Export SVG" color="primary" size="small">
                <GetApp fontSize="small" />
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
                disabled={!diagramId}
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
      </AppBar>

      <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left Sidebar */}
        {showSidebar && (
          <Box
            sx={{
              width: 400,
              flexShrink: 0,
              borderRight: "1px solid #e5e7eb",
              display: "flex",
              flexDirection: "column",
              bgcolor: "white",
              transition: "width 0.3s ease",
            }}
          >
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Sample Diagrams
                </Typography>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => setSamplesOpen(true)}
                  size="small"
                >
                  Browse Samples
                </Button>
              </Box>
              <Divider />
              <Box sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Actions
                </Typography>
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
              </Box>
            </Box>
          </Box>
        )}

        {/* Main Preview Area */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            bgcolor: "white",
            transition: "all 0.3s ease",
            p: isMobile ? 2 : 0,
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

      {/* PNG Export Resolution Dialog */}
      <Dialog open={pngDialogOpen} onClose={() => setPngDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Export PNG</DialogTitle>
        <DialogContent>
          <FormControl component="fieldset" sx={{ mt: 2, width: "100%" }}>
            <FormLabel component="legend" sx={{ mb: 2, fontWeight: 600 }}>
              Select Resolution Quality
            </FormLabel>
            <RadioGroup
              value={pngResolution.toString()}
              onChange={(e) => setPngResolution(Number(e.target.value))}
            >
              <FormControlLabel
                value="1"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1" fontWeight={500}>1x - Standard</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Normal resolution (smallest file size)
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="2"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1" fontWeight={500}>2x - High Quality</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Recommended for most uses (2x pixels)
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="3"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1" fontWeight={500}>3x - Very High Quality</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Great for presentations (3x pixels)
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="4"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1" fontWeight={500}>4x - Ultra Quality</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Maximum quality for print (4x pixels, large file)
                    </Typography>
                  </Box>
                }
              />
            </RadioGroup>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPngDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleExportPNG} variant="contained" color="primary">
            Export
          </Button>
        </DialogActions>
      </Dialog>
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
