"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  AppBar,
  Toolbar,
} from "@mui/material";
import { GetApp } from "@mui/icons-material";
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
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Shared Diagram
          </Typography>
          <Button
            color="inherit"
            startIcon={<GetApp />}
            onClick={handleExportPNG}
          >
            Export PNG
          </Button>
          <Button
            color="inherit"
            startIcon={<GetApp />}
            onClick={handleExportSVG}
          >
            Export SVG
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4, flex: 1 }}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h4" gutterBottom>
            {diagram.title}
          </Typography>
        </Paper>
        <Paper
          sx={{
            p: 3,
            minHeight: 500,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MermaidRenderer code={diagram.code} />
        </Paper>
      </Container>
    </Box>
  );
}

