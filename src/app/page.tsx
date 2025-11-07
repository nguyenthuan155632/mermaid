"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Grid,
} from "@mui/material";
import { Edit, MenuBook } from "@mui/icons-material";

export default function HomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/editor");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (status === "authenticated") {
    return null;
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: "#fafafa" }}>
      <Container maxWidth="lg" sx={{ py: 8, flex: 1 }}>
        <Grid container spacing={6} alignItems="center">
          <Grid item xs={12} md={6}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
              <Box
                component="svg"
                sx={{ width: 80, height: 80 }}
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
              <Typography variant="h3" component="h1" sx={{ fontWeight: 700 }}>
                Mermaid
              </Typography>
            </Box>
            <Typography variant="h4" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
              Create beautiful diagrams with ease
            </Typography>
            <Typography variant="body1" paragraph sx={{ mt: 3, fontSize: "1.1rem", lineHeight: 1.7 }}>
              A powerful, user-friendly editor for creating Mermaid diagrams.
              Support for flowcharts, sequence diagrams, class diagrams, and
              more.
            </Typography>
            <Box sx={{ mt: 4, display: "flex", gap: 2 }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => router.push("/signup")}
                sx={{ px: 4, py: 1.5 }}
              >
                Get Started
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => router.push("/login")}
                sx={{ px: 4, py: 1.5 }}
              >
                Sign In
              </Button>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 4, borderRadius: 2 }} elevation={2}>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                Features
              </Typography>
              <Box component="ul" sx={{ pl: 2, "& li": { mb: 1.5 } }}>
                <Typography component="li" variant="body1">
                  ✨ Real-time diagram preview
                </Typography>
                <Typography component="li" variant="body1">
                  💾 Save and manage multiple diagrams
                </Typography>
                <Typography component="li" variant="body1">
                  📥 Export to PNG and SVG
                </Typography>
                <Typography component="li" variant="body1">
                  🔗 Share diagrams with others
                </Typography>
                <Typography component="li" variant="body1">
                  🤖 AI-powered error fixing
                </Typography>
                <Typography component="li" variant="body1">
                  📚 Sample diagram templates
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

