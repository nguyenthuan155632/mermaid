"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  TextField,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Tab,
  Tabs,
  Divider,
  Chip,
} from "@mui/material";
import {
  Save,
  GetApp,
  Share,
  AutoFixHigh,
  Home,
  GitHub,
  History,
  Menu as MenuIcon,
  Close,
} from "@mui/icons-material";
import SamplesSidebar from "@/components/SamplesSidebar";
import CodeEditor from "@/components/CodeEditor";
import MermaidRenderer from "@/components/MermaidRenderer";
import { useSession, signOut } from "next-auth/react";
import { useDebounce } from "@/hooks/useDebounce";
import { exportToPNG, exportToSVG } from "@/lib/export";

export default function EditorPage() {
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
  const [activeTab, setActiveTab] = useState(0);

  const debouncedCode = useDebounce(code, 300);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const id = searchParams.get("id");

    if (id) {
      fetch(`/api/diagrams/${id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.id) {
            setDiagramId(data.id);
            setTitle(data.title);
            setCode(data.code);
          }
        })
        .catch(() => {
          const savedCode = localStorage.getItem("mermaid-draft");
          if (savedCode) {
            setCode(savedCode);
          }
        });
    } else {
      const savedCode = localStorage.getItem("mermaid-draft");
      if (savedCode) {
        setCode(savedCode);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("mermaid-draft", code);
  }, [code]);

  const handleSave = async () => {
    if (!title.trim()) {
      alert("Please enter a title for your diagram");
      return;
    }

    setSaving(true);
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
      alert("Diagram saved successfully!");
    } catch (err) {
      alert("Failed to save diagram");
    } finally {
      setSaving(false);
    }
  };

  const handleExportPNG = async () => {
    try {
      await exportToPNG(debouncedCode, title || "diagram");
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

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", bgcolor: "#fafafa" }}>
      {/* Header */}
      <AppBar position="static" color="default" elevation={0} sx={{ bgcolor: "white", borderBottom: "1px solid #e5e7eb" }}>
        <Toolbar>
          <IconButton edge="start" onClick={() => setLeftDrawerOpen(!leftDrawerOpen)} sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexGrow: 1 }}>
            <Box
              component="svg"
              sx={{ width: 32, height: 32 }}
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
            <Typography variant="h6" sx={{ fontWeight: 600, color: "text.primary" }}>
              Mermaid Live Editor
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <IconButton onClick={() => window.open("https://github.com", "_blank")}>
              <GitHub />
            </IconButton>
            <IconButton>
              <History />
            </IconButton>
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
              sx={{ bgcolor: "primary.main", color: "white" }}
            >
              {saving ? "Saving..." : "Save diagram"}
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left Sidebar */}
        {leftDrawerOpen && (
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
            <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ borderBottom: 1, borderColor: "divider" }}>
              <Tab label="Code" />
              {/* <Tab label="Config" /> */}
            </Tabs>

            {activeTab === 0 && (
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
                      onClick={handleExportPNG}
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
            )}

            {/* {activeTab === 1 && (
              <Box sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Configuration options coming soon...
                </Typography>
              </Box>
            )} */}
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
    </Box>
  );
}

