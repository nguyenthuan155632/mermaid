"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Typography,
  AppBar,
  Toolbar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  Edit,
  Delete,
  Share,
  Add,
  Home,
  Logout,
} from "@mui/icons-material";
import { useSession, signOut } from "next-auth/react";
import { Diagram } from "@/types";
import MermaidRenderer from "@/components/MermaidRenderer";

export default function DiagramsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    diagramId: string | null;
  }>({ open: false, diagramId: null });

  useEffect(() => {
    if (session) {
      fetchDiagrams();
    }
  }, [session]);

  const fetchDiagrams = async () => {
    try {
      const response = await fetch("/api/diagrams");
      if (response.ok) {
        const data = await response.json();
        setDiagrams(data);
      }
    } catch (error) {
      console.error("Failed to fetch diagrams", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (diagramId: string) => {
    router.push(`/editor?id=${diagramId}`);
  };

  const handleDelete = async () => {
    if (!deleteDialog.diagramId) return;

    try {
      const response = await fetch(`/api/diagrams/${deleteDialog.diagramId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setDiagrams(diagrams.filter((d) => d.id !== deleteDialog.diagramId));
        setDeleteDialog({ open: false, diagramId: null });
      }
    } catch (error) {
      console.error("Failed to delete diagram", error);
    }
  };

  const handleShare = async (diagramId: string) => {
    try {
      const response = await fetch(`/api/diagrams/${diagramId}/share`, {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        const shareUrl = `${window.location.origin}/share/${data.shareToken}`;
        await navigator.clipboard.writeText(shareUrl);
        alert("Share link copied to clipboard!");
      }
    } catch (error) {
      console.error("Failed to share diagram", error);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            My Diagrams
          </Typography>
          <IconButton color="inherit" onClick={() => router.push("/")}>
            <Home />
          </IconButton>
          <Button color="inherit" onClick={() => signOut()}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 3 }}>
        <Box sx={{ mb: 3, display: "flex", justifyContent: "space-between" }}>
          <Typography variant="h4">Saved Diagrams</Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => router.push("/editor")}
          >
            New Diagram
          </Button>
        </Box>

        {diagrams.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No diagrams yet
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => router.push("/editor")}
            >
              Create Your First Diagram
            </Button>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {diagrams.map((diagram) => (
              <Grid item xs={12} sm={6} md={4} key={diagram.id}>
                <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                  <Box sx={{ height: 200, overflow: "hidden" }}>
                    <MermaidRenderer code={diagram.code} />
                  </Box>
                  <CardContent>
                    <Typography variant="h6" component="h2" gutterBottom>
                      {diagram.title}
                    </Typography>
                    {diagram.description && (
                      <Typography variant="body2" color="text.secondary">
                        {diagram.description}
                      </Typography>
                    )}
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<Edit />}
                      onClick={() => handleEdit(diagram.id)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      startIcon={<Share />}
                      onClick={() => handleShare(diagram.id)}
                    >
                      Share
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<Delete />}
                      onClick={() =>
                        setDeleteDialog({ open: true, diagramId: diagram.id })
                      }
                    >
                      Delete
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, diagramId: null })}
      >
        <DialogTitle>Delete Diagram?</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this diagram?</Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialog({ open: false, diagramId: null })}
          >
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

