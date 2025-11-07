"use client";

import { useRef } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { Box } from "@mui/material";
import type * as Monaco from "monaco-editor";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function CodeEditor({ value, onChange }: CodeEditorProps) {
  const monacoRef = useRef<typeof Monaco | null>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Register Mermaid language
    monaco.languages.register({ id: "mermaid" });

    // Define Mermaid syntax highlighting
    monaco.languages.setMonarchTokensProvider("mermaid", {
      defaultToken: "",
      tokenPostfix: ".mmd",

      keywords: [
        "graph",
        "flowchart",
        "sequenceDiagram",
        "classDiagram",
        "stateDiagram",
        "stateDiagram-v2",
        "erDiagram",
        "journey",
        "gantt",
        "pie",
        "gitGraph",
        "mindmap",
        "timeline",
        "quadrantChart",
        "requirementDiagram",
        "C4Context",
        "C4Container",
        "C4Component",
        "C4Dynamic",
        "C4Deployment",
        "title",
        "dateFormat",
        "section",
        "participant",
        "actor",
        "activate",
        "deactivate",
        "note",
        "loop",
        "alt",
        "else",
        "opt",
        "par",
        "and",
        "end",
        "class",
        "direction",
        "TB",
        "TD",
        "BT",
        "RL",
        "LR",
        "subgraph",
        "style",
        "classDef",
        "click",
        "callback",
        "link",
        "linkStyle",
        "interpolate",
        "classDiagram-v2",
      ],

      operators: [
        "-->",
        "---",
        "-.-",
        "==>",
        "==",
        "->>",
        "-->>",
        "->",
        "-)",
        "-.->",
        "::",
        "::::",
        "|",
        "||",
        "o|",
        "}|",
        "||--",
        "o{",
        "}o",
        "--o",
        "--{",
      ],

      symbols: /[=><!~?:&|+\-*\/\^%]+/,

      tokenizer: {
        root: [
          // Comments
          [/%%.*$/, "comment"],

          // Keywords
          [
            /\b(?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|stateDiagram-v2|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|title|dateFormat|section|participant|actor|activate|deactivate|note|loop|alt|else|opt|par|and|end|class|direction|TB|TD|BT|RL|LR|subgraph|style|classDef|click|callback|link|linkStyle|interpolate|classDiagram-v2)\b/,
            "keyword",
          ],

          // Arrows and operators
          [/-->|---|-\.-|==>|==|->>|-->>|->|-\)|\.-\->/, "operator"],
          [/::|::::|o\||}\||o{|}o|--o|--{/, "operator"],

          // Strings
          [/"([^"\\]|\\.)*$/, "string.invalid"], // non-terminated string
          [/"/, "string", "@string_double"],
          [/'([^'\\]|\\.)*$/, "string.invalid"], // non-terminated string
          [/'/, "string", "@string_single"],
          [/`/, "string", "@string_backtick"],

          // Node IDs and labels
          [/\[([^\]]+)\]/, "string"],
          [/\(([^\)]+)\)/, "string"],
          [/{([^}]+)}/, "string"],
          [/>([^>]+)>/, "string"],

          // Numbers
          [/\d+/, "number"],

          // Identifiers
          [/[a-zA-Z_][\w-]*/, "identifier"],

          // Whitespace
          { include: "@whitespace" },

          // Delimiters and operators
          [/[{}()\[\]]/, "@brackets"],
          [/@symbols/, "operator"],
        ],

        whitespace: [
          [/[ \t\r\n]+/, ""],
          [/%%.*$/, "comment"],
        ],

        string_double: [
          [/[^\\"]+/, "string"],
          [/\\./, "string.escape"],
          [/"/, "string", "@pop"],
        ],

        string_single: [
          [/[^\\']+/, "string"],
          [/\\./, "string.escape"],
          [/'/, "string", "@pop"],
        ],

        string_backtick: [
          [/[^\\`]+/, "string"],
          [/\\./, "string.escape"],
          [/`/, "string", "@pop"],
        ],
      },
    });

    // Define Mermaid theme colors
    monaco.editor.defineTheme("mermaidTheme", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "7C3AED", fontStyle: "bold" },
        { token: "operator", foreground: "2563EB", fontStyle: "bold" },
        { token: "string", foreground: "EC4899" },
        { token: "comment", foreground: "6B7280", fontStyle: "italic" },
        { token: "number", foreground: "F59E0B" },
        { token: "identifier", foreground: "1F2937" },
      ],
      colors: {
        "editor.foreground": "#1F2937",
        "editor.background": "#FAFAFA",
        "editor.selectionBackground": "#E0E7FF",
        "editor.lineHighlightBackground": "#F3F4F6",
        "editorCursor.foreground": "#FF2E88",
        "editorLineNumber.foreground": "#9CA3AF",
        "editorLineNumber.activeForeground": "#4B5563",
      },
    });

    // Set the theme
    monaco.editor.setTheme("mermaidTheme");

    // Set language for the model
    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, "mermaid");
    }
  };

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        bgcolor: "#fafafa",
        "& .monaco-editor": {
          paddingTop: "8px",
        },
      }}
    >
      <Editor
        height="100%"
        defaultLanguage="mermaid"
        language="mermaid"
        value={value}
        onChange={(value) => onChange(value || "")}
        onMount={handleEditorDidMount}
        theme="mermaidTheme"
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineHeight: 21,
          fontFamily: "'Monaco', 'Menlo', 'Consolas', 'Ubuntu Mono', monospace",
          lineNumbers: "on",
          glyphMargin: false,
          folding: true,
          lineDecorationsWidth: 10,
          lineNumbersMinChars: 3,
          renderLineHighlight: "all",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: "on",
          wrappingIndent: "indent",
          padding: { top: 8, bottom: 8 },
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          renderWhitespace: "selection",
          scrollbar: {
            vertical: "auto",
            horizontal: "auto",
            useShadows: false,
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
          suggest: {
            showWords: false,
          },
        }}
      />
    </Box>
  );
}

