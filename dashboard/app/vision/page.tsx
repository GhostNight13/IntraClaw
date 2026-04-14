'use client';
import { useState, useRef } from 'react';
import { Eye, Upload, FileImage, Loader2, Copy, Check } from 'lucide-react';

interface VisionResult {
  description: string;
  text: string;
  objects: string[];
  confidence: number;
}

export default function VisionPage() {
  const [image, setImage] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string>('image/png');
  const [prompt, setPrompt] = useState('Describe this image in detail. What do you see?');
  const [result, setResult] = useState<VisionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaType(file.type as string);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      // Strip data URL prefix
      const base64 = result.split(',')[1];
      setImage(base64);
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setMediaType(file.type);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const res = ev.target?.result as string;
      setImage(res.split(',')[1]);
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  async function analyze() {
    if (!image) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('http://localhost:3001/api/vision/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, mediaType, prompt }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: VisionResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }

  async function copyResult() {
    if (!result) return;
    await navigator.clipboard.writeText(result.description);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Eye className="w-6 h-6 text-purple-400" />
        <h1 className="text-2xl font-bold text-white">Vision Analysis</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upload Area */}
        <div className="space-y-4">
          <div
            className="border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center cursor-pointer hover:border-purple-500 transition-colors"
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            {image ? (
              <div className="space-y-2">
                <img
                  src={`data:${mediaType};base64,${image}`}
                  alt="Preview"
                  className="max-h-48 mx-auto rounded-lg object-contain"
                />
                <p className="text-sm text-zinc-400">Click to replace</p>
              </div>
            ) : (
              <div className="space-y-3">
                <FileImage className="w-12 h-12 text-zinc-600 mx-auto" />
                <div>
                  <p className="text-white font-medium">Drop image here</p>
                  <p className="text-sm text-zinc-400 mt-1">or click to browse</p>
                </div>
                <p className="text-xs text-zinc-600">PNG, JPG, WEBP, GIF</p>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

          <div className="space-y-2">
            <label className="text-sm text-zinc-400 font-medium">Prompt</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={3}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPrompt('Describe this image in detail.')}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg px-3 py-2 transition-colors"
            >
              Describe
            </button>
            <button
              onClick={() => setPrompt('Extract all text from this image.')}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg px-3 py-2 transition-colors"
            >
              Extract Text
            </button>
            <button
              onClick={() => setPrompt('List all objects and elements visible.')}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg px-3 py-2 transition-colors"
            >
              List Objects
            </button>
            <button
              onClick={() => setPrompt('Analyze this screenshot and explain what the UI shows.')}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg px-3 py-2 transition-colors"
            >
              Analyze UI
            </button>
          </div>

          <button
            onClick={analyze}
            disabled={!image || loading}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-4 py-3 font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
            ) : (
              <><Eye className="w-4 h-4" /> Analyze Image</>
            )}
          </button>

          {error && (
            <div className="bg-red-950/50 border border-red-800 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Result */}
        <div className="space-y-4">
          {result ? (
            <div className="space-y-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-zinc-400">Analysis Result</h3>
                  <button onClick={copyResult} className="text-zinc-500 hover:text-white transition-colors">
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{result.description}</p>
              </div>

              {result.objects.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-zinc-400 mb-3">Detected Objects</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.objects.map(obj => (
                      <span key={obj} className="text-xs bg-purple-950/50 border border-purple-800 text-purple-300 rounded-full px-3 py-1">
                        {obj}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.text && result.text !== result.description && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-zinc-400 mb-2">Extracted Text</h3>
                  <pre className="text-white text-xs font-mono whitespace-pre-wrap">{result.text}</pre>
                </div>
              )}

              <div className="text-xs text-zinc-600">
                Confidence: {Math.round(result.confidence * 100)}%
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-600 border border-dashed border-zinc-800 rounded-xl p-8">
              <div className="text-center space-y-2">
                <Upload className="w-8 h-8 mx-auto" />
                <p className="text-sm">Upload an image and click Analyze</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
