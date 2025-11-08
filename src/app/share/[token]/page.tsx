"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Box,
  Typography,
  Button,
  AppBar,
  Toolbar,
  Stack,
  useTheme,
  useMediaQuery,
  IconButton,
} from "@mui/material";
import { GetApp, ExpandMore, Close as CloseIcon, Image as ImageIcon } from "@mui/icons-material";
import MermaidRenderer from "@/components/MermaidRenderer";
import { exportToPNG, exportToSVG } from "@/lib/export";

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;
  const [diagram, setDiagram] = useState<{
    title: string;
    code: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  useEffect(() => {
    if (token) {
      fetch(`/api/share/${token}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.code) {
            setDiagram(data);
          }
        })
        .catch(() => { })
        .finally(() => setLoading(false));
    }
  }, [token]);

  const handleExportPNG = async () => {
    if (diagram) {
      await exportToPNG(diagram.code, diagram.title);
    }
  };

  const handleExportSVG = async () => {
    if (diagram) {
      await exportToSVG(diagram.code, diagram.title);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (!diagram) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Diagram not found</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
      <AppBar
        position="static"
        color="default"
        elevation={0}
        sx={{
          bgcolor: "white",
          borderBottom: "1px solid #e5e7eb"
        }}
      >
        <Toolbar
          sx={{
            minHeight: { xs: 56, md: 64 },
            gap: isMobile ? 0.5 : 1,
            px: { xs: 1, md: 2 }
          }}
        >
          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 1,
              fontWeight: 600,
              fontSize: { xs: "0.95rem", md: "1.25rem" },
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              color: "text.primary"
            }}
          >
            {diagram?.title || "Shared Diagram"}
          </Typography>

          {isMobile ? (
            <>
              <IconButton
                onClick={() => setDetailsOpen((prev) => !prev)}
                title={detailsOpen ? "Hide Details" : "Show Details"}
                color="primary"
                size="small"
              >
                <ExpandMore
                  fontSize="small"
                  sx={{
                    transform: detailsOpen ? "rotate(180deg)" : "rotate(0)",
                    transition: "transform 0.2s"
                  }}
                />
              </IconButton>
              <IconButton
                onClick={handleExportPNG}
                title="Export PNG"
                color="primary"
                size="small"
              >
                <ImageIcon fontSize="small" />
              </IconButton>
              <IconButton
                onClick={handleExportSVG}
                title="Export SVG"
                color="primary"
                size="small"
              >
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
                endIcon={
                  <ExpandMore
                    sx={{
                      transform: detailsOpen ? "rotate(180deg)" : "rotate(0)",
                      transition: "transform 0.2s"
                    }}
                  />
                }
                onClick={() => setDetailsOpen((prev) => !prev)}
              >
                {detailsOpen ? "Hide Details" : "Show Details"}
              </Button>
              <Button
                variant="text"
                startIcon={<ImageIcon />}
                onClick={handleExportPNG}
              >
                Export PNG
              </Button>
              <Button
                variant="text"
                startIcon={<GetApp />}
                onClick={handleExportSVG}
              >
                Export SVG
              </Button>
            </Stack>
          )}
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, position: "relative", bgcolor: "background.default" }}>
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            px: { xs: 1, md: 4 },
            py: { xs: 2, md: 4 },
          }}
        >
          <MermaidRenderer code={diagram.code} />
        </Box>
        {detailsOpen && (
          <Box
            sx={{
              position: "absolute",
              top: { xs: 12, md: 24 },
              left: { xs: 12, md: 24 },
              bgcolor: "rgba(255,255,255,0.95)",
              borderRadius: 2,
              boxShadow: 4,
              p: 2,
              width: { xs: "calc(100% - 24px)", md: 320 },
            }}
          >
            <Stack direction="row" alignItems="flex-start" spacing={1}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ letterSpacing: 1, textTransform: "uppercase" }}>
                  Shared diagram
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, mt: 0.5 }}>
                  {diagram.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Anyone with this link can view the diagram and export it.
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => setDetailsOpen(false)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Box>
        )}
      </Box>
    </Box >
  );
}
