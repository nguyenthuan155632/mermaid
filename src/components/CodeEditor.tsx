"use client";

import Editor from "react-simple-code-editor";
import { highlight, languages } from "prismjs";
import "prismjs/components/prism-markdown";
import "prismjs/themes/prism.css";
import { Box } from "@mui/material";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function CodeEditor({ value, onChange }: CodeEditorProps) {
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        bgcolor: "#fafafa",
        "& .token.keyword": {
          color: "#7C3AED",
        },
        "& .token.string": {
          color: "#EC4899",
        },
        "& .token.number": {
          color: "#F59E0B",
        },
        "& .token.operator": {
          color: "#6B7280",
        },
        "& textarea": {
          outline: "none !important",
        },
      }}
    >
      <Editor
        value={value}
        onValueChange={onChange}
        highlight={(code) => highlight(code, languages.markdown, "markdown")}
        padding={16}
        style={{
          fontFamily: '"Monaco", "Menlo", "Ubuntu Mono", monospace',
          fontSize: 13,
          lineHeight: 1.6,
          width: "100%",
          height: "100%",
          overflow: "auto",
          backgroundColor: "#fafafa",
          caretColor: "#FF2E88",
        }}
      />
    </Box>
  );
}

