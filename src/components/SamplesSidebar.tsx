"use client";

import { useState, useEffect } from "react";
import {
  Drawer,
  Typography,
  Box,
  IconButton,
  Chip,
  Button,
} from "@mui/material";
import { Close, AccountTree } from "@mui/icons-material";

interface SampleDiagram {
  id: string;
  title: string;
  code: string;
  description: string | null;
  category: string;
}

interface SamplesSidebarProps {
  open: boolean;
  onClose: () => void;
  onSelectSample: (code: string) => void;
}

export default function SamplesSidebar({
  open,
  onClose,
  onSelectSample,
}: SamplesSidebarProps) {
  const [samples, setSamples] = useState<SampleDiagram[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSamples();
  }, []);

  const fetchSamples = async () => {
    try {
      const response = await fetch("/api/samples");
      if (response.ok) {
        const data = await response.json();
        setSamples(data);
      }
    } catch (error) {
      console.error("Failed to fetch samples", error);
    } finally {
      setLoading(false);
    }
  };

  // Group samples by category
  const categories = Array.from(new Set(samples.map((s) => s.category)));

  return (
    <Drawer 
      anchor="right" 
      open={open} 
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 500 },
          bgcolor: "#fafafa",
        },
      }}
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
          <AccountTree sx={{ color: "primary.main" }} />
          <Typography variant="h6" sx={{ flex: 1, fontWeight: 600 }}>
            Sample Diagrams
          </Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: "auto", p: 3 }}>
          {loading ? (
            <Typography color="text.secondary">Loading samples...</Typography>
          ) : (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
              {samples.map((sample) => (
                <Button
                  key={sample.id}
                  variant="outlined"
                  onClick={() => {
                    onSelectSample(sample.code);
                    onClose();
                  }}
                  sx={{
                    borderRadius: "20px",
                    textTransform: "none",
                    px: 3,
                    py: 1,
                    bgcolor: "white",
                    border: "1px solid #e5e7eb",
                    color: "text.primary",
                    "&:hover": {
                      bgcolor: "primary.main",
                      color: "white",
                      borderColor: "primary.main",
                    },
                  }}
                >
                  {sample.title}
                </Button>
              ))}
            </Box>
          )}

          {/* Categories Info */}
          {!loading && categories.length > 0 && (
            <Box sx={{ mt: 4 }}>
              <Typography
                variant="subtitle2"
                sx={{ mb: 2, color: "text.secondary", fontWeight: 600 }}
              >
                Categories
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {categories.map((category) => (
                  <Chip
                    key={category}
                    label={category}
                    size="small"
                    sx={{
                      bgcolor: "white",
                      border: "1px solid #e5e7eb",
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Drawer>
  );
}

