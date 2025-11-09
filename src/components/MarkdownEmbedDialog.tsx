"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  Box,
  Typography,
  IconButton,
  Alert,
  Snackbar,
  useMediaQuery,
  useTheme,
  Stack,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
} from "@mui/material";
import {
  ContentCopy,
  Close,
  CheckCircle,
  Link as LinkIcon,
  Code,
} from "@mui/icons-material";
import Slide from "@mui/material/Slide";

interface MarkdownEmbedDialogProps {
  open: boolean;
  onClose: () => void;
  diagramId: string;
  diagramTitle: string;
  baseUrl?: string;
}

export default function MarkdownEmbedDialog({
  open,
  onClose,
  diagramId,
  diagramTitle,
  baseUrl = "",
}: MarkdownEmbedDialogProps) {
  const [shareMode, setShareMode] = useState<"markdown" | "url">("markdown");
  const [format, setFormat] = useState<"png" | "svg">("png");
  const [resolution, setResolution] = useState("2");
  const [background, setBackground] = useState<"white" | "transparent">("white");
  const [exportToken, setExportToken] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  useEffect(() => {
    if (open && diagramId) {
      generateExportToken();
    }
  }, [open, diagramId]);

  const generateExportToken = async () => {
    setError(null);
    try {
      const response = await fetch(`/api/diagrams/${diagramId}/export-token`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to generate export token");
      const data = await response.json();
      setExportToken(data.exportToken);
    } catch (err) {
      setError("Failed to generate export link. Please try again.");
      console.error("Export token error:", err);
    }
  };

  const exportUrl = useMemo(() => {
    if (!exportToken) return "";
    const params = new URLSearchParams({
      format,
      resolution,
      background,
      token: exportToken,
    });
    return `${baseUrl}/api/export/${diagramId}?${params.toString()}`;
  }, [background, baseUrl, diagramId, exportToken, format, resolution]);

  const markdownLink = useMemo(() => {
    if (!exportUrl) return "";
    const editorUrl = `${baseUrl}/editor?id=${diagramId}`;
    return `[![](${exportUrl})](${editorUrl})`;
  }, [baseUrl, diagramId, exportUrl]);

  const handleCopy = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 1500);
    } catch (err) {
      setError("Failed to copy to clipboard");
      console.error("Copy error:", err);
    }
  };

  const handleClose = () => {
    setShareMode("markdown");
    onClose();
  };

  const shareText = shareMode === "markdown" ? markdownLink : exportUrl;
  const shareLabel = shareMode === "markdown" ? "Markdown" : "Direct URL";

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="xs"
        fullWidth
        keepMounted
        TransitionComponent={Slide}
        TransitionProps={{ direction: isMobile ? "up" : "left" }}
        PaperProps={{
          sx: (muiTheme) => ({
            m: 0,
            borderRadius: {
              xs: "18px 18px 0 0",
              sm: muiTheme.spacing(2),
            },
            alignSelf: { xs: "flex-end", sm: "flex-end" },
            ml: { sm: "auto" },
            mr: { sm: muiTheme.spacing(2) },
            width: "100%",
            maxWidth: 420,
            height: { xs: "50vh", sm: "auto" },
            maxHeight: { xs: "50vh", sm: "75vh" },
            border: `1px solid ${muiTheme.palette.divider}`,
            boxShadow: "0 6px 30px rgba(15,23,42,0.07)",
            backgroundColor:
              muiTheme.palette.mode === "dark"
                ? "rgba(15,18,20,0.96)"
                : muiTheme.palette.background.paper,
          }),
        }}
      >
        <Stack spacing={1.5} sx={{ p: { xs: 1.5, sm: 2 } }}>
          {/* Header */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              minHeight: 32,
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="subtitle2"
                fontSize="0.78rem"
                noWrap
                sx={{ letterSpacing: 0.2 }}
              >
                {diagramTitle}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: "0.66rem" }}
              >
                Embed options
              </Typography>
            </Box>
            <IconButton onClick={handleClose} size="small" sx={{ p: 0.5 }}>
              <Close fontSize="small" />
            </IconButton>
          </Box>

          <Divider flexItem />

          {/* Format Controls */}
          <Stack spacing={1}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: 0.6 }}
            >
              Output
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={format}
              onChange={(_, value) => value && setFormat(value)}
              sx={(muiTheme) => ({
                width: "100%",
                "& .MuiToggleButtonGroup-grouped": {
                  flex: 1,
                  px: 1.25,
                  py: 0.4,
                  borderRadius: muiTheme.spacing(1),
                  borderColor: muiTheme.palette.divider,
                  fontSize: "0.75rem",
                  textTransform: "none",
                  "&:not(:first-of-type)": {
                    ml: 0.5,
                    borderColor: muiTheme.palette.divider,
                  },
                  "&.Mui-selected": {
                    color: muiTheme.palette.primary.main,
                    backgroundColor:
                      muiTheme.palette.mode === "dark"
                        ? "rgba(148,163,184,0.14)"
                        : "rgba(15,23,42,0.04)",
                  },
                },
              })}
            >
              <ToggleButton value="png">PNG</ToggleButton>
              <ToggleButton value="svg">SVG</ToggleButton>
            </ToggleButtonGroup>

            {format === "png" && (
              <ToggleButtonGroup
                exclusive
                size="small"
                value={resolution}
                onChange={(_, value) => value && setResolution(value)}
                sx={(muiTheme) => ({
                  width: "100%",
                  flexWrap: "wrap",
                  gap: 0.5,
                  "& .MuiToggleButtonGroup-grouped": {
                    flex: "1 1 64px",
                    px: 1,
                    py: 0.35,
                    borderRadius: muiTheme.spacing(1),
                    borderColor: muiTheme.palette.divider,
                    fontSize: "0.72rem",
                    textTransform: "none",
                    "&.Mui-selected": {
                      color: muiTheme.palette.primary.main,
                      backgroundColor:
                        muiTheme.palette.mode === "dark"
                          ? "rgba(148,163,184,0.14)"
                          : "rgba(15,23,42,0.04)",
                    },
                  },
                })}
              >
                {["1", "2", "3", "4"].map((value) => (
                  <ToggleButton key={value} value={value}>
                    {value}x
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            )}

            <ToggleButtonGroup
              exclusive
              size="small"
              value={background}
              onChange={(_, value) => value && setBackground(value)}
              sx={(muiTheme) => ({
                width: "100%",
                "& .MuiToggleButtonGroup-grouped": {
                  flex: 1,
                  px: 1,
                  py: 0.35,
                  borderRadius: muiTheme.spacing(1),
                  borderColor: muiTheme.palette.divider,
                  fontSize: "0.72rem",
                  textTransform: "none",
                  "&:not(:first-of-type)": {
                    ml: 0.5,
                    borderColor: muiTheme.palette.divider,
                  },
                  "&.Mui-selected": {
                    color: muiTheme.palette.primary.main,
                    backgroundColor:
                      muiTheme.palette.mode === "dark"
                        ? "rgba(148,163,184,0.14)"
                        : "rgba(15,23,42,0.04)",
                  },
                },
              })}
            >
              <ToggleButton value="white">White</ToggleButton>
              <ToggleButton value="transparent">Transparent</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <Divider flexItem />

          {/* Share Mode */}
          <Stack spacing={0.75}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: 0.6 }}
            >
              Embed format
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={shareMode}
              onChange={(_, value) => value && setShareMode(value)}
              sx={(muiTheme) => ({
                "& .MuiToggleButtonGroup-grouped": {
                  flex: 1,
                  gap: 0.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  px: 1.2,
                  py: 0.4,
                  borderRadius: muiTheme.spacing(1),
                  borderColor: muiTheme.palette.divider,
                  fontSize: "0.72rem",
                  textTransform: "none",
                  "& svg": { fontSize: "0.9rem" },
                  "&:not(:first-of-type)": {
                    ml: 0.5,
                    borderColor: muiTheme.palette.divider,
                  },
                  "&.Mui-selected": {
                    color: muiTheme.palette.primary.main,
                    backgroundColor:
                      muiTheme.palette.mode === "dark"
                        ? "rgba(148,163,184,0.14)"
                        : "rgba(15,23,42,0.04)",
                  },
                },
              })}
            >
              <ToggleButton value="markdown">
                <Code fontSize="inherit" />
                &nbsp;MD
              </ToggleButton>
              <ToggleButton value="url">
                <LinkIcon fontSize="inherit" />
                &nbsp;URL
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          {/* Share Output */}
          <Stack spacing={0.75}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: 0.6 }}
              >
                {shareLabel}
              </Typography>
              {copied === shareMode && (
                <Typography
                  variant="caption"
                  color="success.main"
                  sx={{ fontSize: "0.65rem" }}
                >
                  Copied
                </Typography>
              )}
            </Box>
            <Box
              sx={{
                display: "flex",
                alignItems: "stretch",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                overflow: "hidden",
                backgroundColor:
                  theme.palette.mode === "dark"
                    ? "rgba(255,255,255,0.02)"
                    : "rgba(15,23,42,0.02)",
              }}
            >
              <Box
                component="pre"
                sx={{
                  flex: 1,
                  m: 0,
                  px: 1.25,
                  py: 0.9,
                  fontSize: "0.7rem",
                  lineHeight: 1.4,
                  maxHeight: 96,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  color: "text.primary",
                }}
              >
                {shareText}
              </Box>
              <Tooltip
                title={copied === shareMode ? "Copied!" : "Copy"}
                placement="left"
              >
                <Box component="span" sx={{ display: "flex" }}>
                  <IconButton
                    onClick={() => shareText && handleCopy(shareText, shareMode)}
                    size="small"
                    sx={{
                      borderLeft: "1px solid",
                      borderColor: "divider",
                      borderRadius: 0,
                      width: 44,
                      flexShrink: 0,
                    }}
                    disabled={!shareText}
                  >
                    {copied === shareMode ? (
                      <CheckCircle fontSize="inherit" color="success" />
                    ) : (
                      <ContentCopy fontSize="inherit" />
                    )}
                  </IconButton>
                </Box>
              </Tooltip>
            </Box>
          </Stack>
        </Stack>
      </Dialog>

      <Snackbar
        open={!!error}
        autoHideDuration={4000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: "100%" }}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
}
