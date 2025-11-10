"use client";

import {
  Box,
  Button,
  Container,
  Typography,
  Paper,
} from "@mui/material";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "#fafafa",
        }}
      >
        <Paper sx={{ p: 5, width: "100%", borderRadius: 2 }} elevation={2}>
          <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
            <Box
              component="svg"
              sx={{ width: 64, height: 64 }}
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
          </Box>
          <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ fontWeight: 600, mb: 3 }}>
            Welcome to Mermaid
          </Typography>
          <Typography variant="body1" align="center" sx={{ mb: 4, color: "text.secondary" }}>
            Sign in to create and manage your diagrams
          </Typography>

          <Button
            fullWidth
            variant="contained"
            size="large"
            startIcon={
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z" />
                <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 0 1-7.18-2.53H1.83v2.07A8 8 0 0 0 8.98 17z" />
                <path fill="#FBBC05" d="M4.5 10.49a4.8 4.8 0 0 1 0-3.07V5.35H1.83a8 8 0 0 0 0 7.21l2.67-2.07z" />
                <path fill="#EA4335" d="M8.98 4.72c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.35L4.5 7.42a4.77 4.77 0 0 1 4.48-2.7z" />
              </svg>
            }
            onClick={() => signIn("google", { callbackUrl: "/editor" })}
            sx={{
              py: 1.5,
              bgcolor: "white",
              color: "#3c4043",
              border: "1px solid #dadce0",
              boxShadow: "0 1px 2px 0 rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15)",
              "&:hover": {
                bgcolor: "#f8f9fa",
                boxShadow: "0 1px 3px 0 rgba(60,64,67,.3), 0 4px 8px 3px rgba(60,64,67,.15)",
              }
            }}
          >
            Continue with Google
          </Button>
        </Paper>
      </Box>
    </Container>
  );
}
