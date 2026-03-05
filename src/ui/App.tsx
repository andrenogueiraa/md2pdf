import React, { useState, useRef } from "react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Select } from "./components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/card";
import { Label } from "./components/ui/label";

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [margins, setMargins] = useState({ top: 20, right: 15, bottom: 20, left: 15 });
  const [format, setFormat] = useState("A4");
  const [textAlign, setTextAlign] = useState("justify");
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleConvert = async () => {
    if (!file) return;
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("format", format);
      formData.append("marginTop", String(margins.top));
      formData.append("marginRight", String(margins.right));
      formData.append("marginBottom", String(margins.bottom));
      formData.append("marginLeft", String(margins.left));
      formData.append("textAlign", textAlign);

      const res = await fetch("/api/convert", { method: "POST", body: formData });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Conversion failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name.replace(/\.md$/i, "") + ".pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const marginField = (label: string, key: keyof typeof margins) => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          value={margins[key]}
          onChange={(e) => setMargins((m) => ({ ...m, [key]: Number(e.target.value) }))}
          className="w-24"
        />
        <span className="text-sm text-muted-foreground">mm</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>md2pdf</CardTitle>
          <p className="text-sm text-muted-foreground">Convert Markdown to PDF</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-1">
            <Label>Markdown file</Label>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".md"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>

          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
            onClick={() => setShowSettings((s) => !s)}
          >
            {showSettings ? "▾ Settings" : "▸ Settings"}
          </button>

          {showSettings && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {marginField("Top", "top")}
                {marginField("Bottom", "bottom")}
                {marginField("Left", "left")}
                {marginField("Right", "right")}
              </div>

              <div className="space-y-1">
                <Label>Page format</Label>
                <Select value={format} onChange={(e) => setFormat(e.target.value)}>
                  <option value="A4">A4</option>
                  <option value="Letter">Letter</option>
                  <option value="Legal">Legal</option>
                  <option value="A3">A3</option>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Text alignment</Label>
                <Select value={textAlign} onChange={(e) => setTextAlign(e.target.value)}>
                  <option value="left">Left</option>
                  <option value="justify">Justified</option>
                </Select>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button className="w-full" onClick={handleConvert} disabled={!file || loading}>
            {loading ? "Converting..." : "Convert"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
